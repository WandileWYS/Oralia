import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer, type RequestListener } from 'node:http';
import { readFile, mkdir, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createClient } from '@libsql/client';
import nodemailer from 'nodemailer';
import { catalogSchema } from '../src/types/api.ts';
import { creatorSessionSchema } from '../src/types/creator.ts';
import { ServiceError } from './errors.ts';
import { H3 } from 'nitro/h3';
import { toNodeHandler } from 'srvx/node';

test('production API: secure emailed codes, cookies, ownership and persisted creation jobs',async t=>{
  await mkdir('.qa',{recursive:true});const file=`.qa/production-api-${randomUUID()}.db`;const url=`file:./${file}`;
  const sqlite=createClient({url});
  for(const migration of ['20261105000000_init','20261106000000_thematic_collections','20261107000000_production_pipeline'])await sqlite.executeMultiple(await readFile(`prisma/migrations/${migration}/migration.sql`,'utf8'));
  sqlite.close();
  Object.assign(process.env,{DATABASE_URL:url,AUTH_SECRET:'production-test-only-secret-32-characters-long',APP_ORIGIN:'http://127.0.0.1',SMTP_HOST:'smtp.example.test',SMTP_PORT:'587',SMTP_USER:'sender@example.test',SMTP_PASSWORD:'test-only',OPENAI_API_KEY:'test-only',GEMINI_API_KEY:'test-only',CLOUDINARY_CLOUD_NAME:'test-only',CLOUDINARY_API_KEY:'test-only',CLOUDINARY_API_SECRET:'test-only'});
  delete process.env.VERCEL;
  const seed=()=>execFileSync(process.execPath,['node_modules/tsx/dist/cli.mjs','prisma/seed.ts'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
  seed();
  const codes=new Map<string,string>();let rejectMail=false;
  const mailMock=mock.method(nodemailer,'createTransport',()=>({
    async sendMail(message:{to:string;text:string}){if(rejectMail)throw new Error('Provider rejected test message.');codes.set(message.to,message.text.match(/\b\d{6}\b/)![0]);return {accepted:[message.to]};},close(){},
  } as unknown as ReturnType<typeof nodemailer.createTransport>));
  const {db}=await import('./db.ts');const {default:apiRoute}=await import('../routes/api/v1/[...route].ts');const {workflowRuntime}=await import('./workflowRuntime.ts');
  const launches:string[]=[];let dispatchUnknown=false;
  const workflowMock=mock.method(workflowRuntime,'create',async(id:string)=>{if(dispatchUnknown)throw new Error('Queue acknowledgement lost');launches.push(id);return {runId:'test-run-'+id} as Awaited<ReturnType<typeof workflowRuntime.create>>;});
  const application=new H3().all('/api/v1/**',apiRoute);
  // Strip the local Node runtime carrier so the same Fetch-to-Node boundary used on Vercel is exercised.
  const server=createServer(toNodeHandler(request=>application.fetch(new Request(request.url,{method:request.method,headers:request.headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body,duplex:'half'} as RequestInit))) as RequestListener);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();assert.ok(address&&typeof address!=='string');const base=`http://127.0.0.1:${address.port}`;
  const call=(path:string,method='GET',value?:unknown,cookie?:string)=>fetch(base+'/api/v1'+path,{method,headers:{'Content-Type':'application/json',Connection:'close',...(cookie?{Cookie:cookie}:{})},...(value!==undefined?{body:JSON.stringify(value)}:{})});
  const requestCode=async(email:string)=>{const response=await call('/auth/otp/request','POST',{email});assert.equal(response.status,200);return await response.json() as {challengeId:string;expiresAt:string};};
  const login=async(email:string)=>{const challenge=await requestCode(email);const response=await call('/auth/otp/verify','POST',{challengeId:challenge.challengeId,pin:codes.get(email)});assert.equal(response.status,200);return {session:creatorSessionSchema.parse(await response.json()),cookie:response.headers.get('set-cookie')!.split(';')[0],header:response.headers.get('set-cookie')!};};
  try{
    await t.test('catalog preserves eight attributed stories and all collection filters',async()=>{
      const catalog=catalogSchema.parse(await(await call('/catalog')).json());assert.equal(catalog.stories.length,8);assert.equal(catalog.stories.flatMap(story=>story.presentation.keyframes).length,32);
      assert.equal(catalogSchema.parse(await(await call('/catalog?collection=FOLK_AND_FABLE')).json()).stories.length,6);assert.equal(catalogSchema.parse(await(await call('/catalog?collection=EPIC_AND_CHRONICLE')).json()).stories.length,2);assert.equal((await call('/catalog?collection=ALL')).status,400);
      assert.equal((await call('/stories/anansi-wisdom')).status,200);assert.equal((await call('/creators/akan_stories')).status,200);assert.equal((await call('/unknown')).status,404);
    });
    await t.test('codes are random, hashed, expire, reject wrong values and cannot be replayed',async()=>{
      assert.equal((await call('/auth/otp/request','POST',{email:'invalid'})).status,400);assert.equal((await call('/auth/otp/request','POST',{email:'akan@collections.oralia.invalid'})).status,400);
      const challenge=await requestCode('secure@example.test');const pin=codes.get('secure@example.test')!;const stored=await db.otpChallenge.findUniqueOrThrow({where:{id:challenge.challengeId}});assert.notEqual(stored.codeHash,pin);assert.equal(stored.codeHash.length,64);assert.ok(stored.sentAt);assert.ok(Date.parse(challenge.expiresAt)>Date.now()+9*60000);
      const wrong=pin==='000000'?'111111':'000000';assert.equal((await call('/auth/otp/verify','POST',{challengeId:challenge.challengeId,pin:wrong})).status,400);assert.equal((await db.otpChallenge.findUniqueOrThrow({where:{id:challenge.challengeId}})).attempts,1);
      assert.equal((await call('/auth/otp/verify','POST',{challengeId:challenge.challengeId,pin})).status,200);assert.equal((await call('/auth/otp/verify','POST',{challengeId:challenge.challengeId,pin})).status,400);
      assert.equal((await call('/auth/otp/request','POST',{email:'secure@example.test'})).status,429);
      const expired=await requestCode('expired@example.test');await db.otpChallenge.update({where:{id:expired.challengeId},data:{expiresAt:new Date(0)}});assert.equal((await call('/auth/otp/verify','POST',{challengeId:expired.challengeId,pin:codes.get('expired@example.test')})).status,400);
      const limited=await requestCode('attempts@example.test');const expected=codes.get('attempts@example.test')!;for(let i=0;i<5;i++)assert.equal((await call('/auth/otp/verify','POST',{challengeId:limited.challengeId,pin:expected==='000000'?'111111':'000000'})).status,400);assert.equal((await call('/auth/otp/verify','POST',{challengeId:limited.challengeId,pin:expected})).status,400);
    });
    await t.test('SMTP failure invalidates its challenge and issues no session',async()=>{
      const before=await db.session.count();rejectMail=true;assert.equal((await call('/auth/otp/request','POST',{email:'mail-failed@example.test'})).status,503);rejectMail=false;assert.equal((await db.otpChallenge.findFirstOrThrow({where:{email:'mail-failed@example.test'}})).used,true);assert.equal(await db.session.count(),before);
    });
    const first=await login('first@example.test');const second=await login('second@example.test');
    await t.test('verified identity uses HttpOnly cookies and rejects legacy bearer tokens',async()=>{
      assert.equal(first.session.kind,'verified-email');assert.ok(!('token' in first.session));assert.match(first.header,/HttpOnly/);assert.match(first.header,/SameSite=Lax/);assert.ok((await db.user.findUniqueOrThrow({where:{id:first.session.id}})).emailVerifiedAt);
      assert.equal((await call('/auth/session')).status,401);assert.equal((await call('/auth/session','GET',undefined,first.cookie)).status,200);
      assert.equal((await fetch(base+'/api/v1/auth/session',{headers:{Authorization:'Bearer '+first.cookie.split('=')[1]}})).status,401);
      const foreign=await fetch(base+'/api/v1/auth/otp/request',{method:'POST',headers:{Origin:'https://foreign.example','Content-Type':'application/json'},body:JSON.stringify({email:'origin@example.test'})});assert.equal(foreign.status,403);
    });
    await t.test('bookmarks stay account scoped, idempotent and survive reseeding',async()=>{
      for(let i=0;i<2;i++)assert.equal((await call('/bookmarks/anansi-wisdom','PUT',undefined,first.cookie)).status,200);assert.equal(await db.bookmark.count(),1);assert.deepEqual(await(await call('/bookmarks','GET',undefined,second.cookie)).json(),{storyIds:[]});seed();assert.deepEqual(await(await call('/bookmarks','GET',undefined,first.cookie)).json(),{storyIds:['anansi-wisdom']});
    });
    await t.test('creation is persisted, idempotent and owner-only before workflow launch',async()=>{
      const input={title:'A river remembers',text:'A traveler follows a river and learns to listen.',collection:'FOLK_AND_FABLE',region:'originals',language:'en',provenance:'An original story written for this isolated test.'};const requestKey=randomUUID();
      assert.equal((await call('/creations','POST',{input,requestKey})).status,401);const response=await call('/creations','POST',{input,requestKey},first.cookie);assert.equal(response.status,202);const job=await response.json();assert.equal(job.status,'QUEUED');assert.equal((await call('/creations/'+job.id,'GET',undefined,second.cookie)).status,404);
      assert.equal((await call('/creations','POST',{input,requestKey},first.cookie)).status,202);assert.equal(await db.creationJob.count(),1);assert.equal(launches.length,1);
      assert.equal((await call('/creations','POST',{input:{...input,text:'x'.repeat(5001)},requestKey:randomUUID()},first.cookie)).status,400);
      delete process.env.OPENAI_API_KEY;assert.equal((await call('/creations','POST',{input,requestKey:randomUUID()},first.cookie)).status,503);process.env.OPENAI_API_KEY='test-only';assert.equal((await call('/images/keyframe','POST',{},first.cookie)).status,404);
      const multilingual={...input,text:'Thandé follows the river and listens to her grandmother’s story.'};const unicodeKey=randomUUID();const encoded=Buffer.from(JSON.stringify({input:multilingual,requestKey:unicodeKey}));const split=encoded.indexOf(Buffer.from('é'))+1;
      const stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(encoded.subarray(0,split));setTimeout(()=>{controller.enqueue(encoded.subarray(split));controller.close();},5);}});
      const streamed=await application.fetch(new Request(base+'/api/v1/creations',{method:'POST',headers:{'Content-Type':'application/json',Cookie:first.cookie},body:stream,duplex:'half'} as RequestInit));assert.equal(streamed.status,202);
      assert.equal(JSON.parse((await db.creationJob.findUniqueOrThrow({where:{userId_requestKey:{userId:first.session.id,requestKey:unicodeKey}}})).inputJson).text,multilingual.text);
      assert.equal((await call('/auth/otp/request','POST',{email:'x'.repeat(128*1024)})).status,413);
      await db.creationJob.updateMany({where:{userId:first.session.id},data:{status:'FAILED',retryable:false}});dispatchUnknown=true;const unknownKey=randomUUID();assert.equal((await call('/creations','POST',{input,requestKey:unknownKey},first.cookie)).status,503);dispatchUnknown=false;
      const unconfirmed=await db.creationJob.findUniqueOrThrow({where:{userId_requestKey:{userId:first.session.id,requestKey:unknownKey}}});assert.equal(unconfirmed.status,'INDETERMINATE');assert.equal(unconfirmed.retryable,false);assert.equal((await call('/creations/'+unconfirmed.id+'/retry','POST',{},first.cookie)).status,409);
    });
    await t.test('logout revokes the server session and expires its cookie',async()=>{
      const response=await call('/auth/logout','POST',{},first.cookie);assert.equal(response.status,200);assert.match(response.headers.get('set-cookie')!,/1970/);assert.equal((await call('/auth/session','GET',undefined,first.cookie)).status,401);
      await db.session.updateMany({where:{userId:second.session.id},data:{expiresAt:new Date(0)}});assert.equal((await call('/auth/session','GET',undefined,second.cookie)).status,401);
    });
    await t.test('authentication IP limits are durable',async()=>{
      const {createAuthService}=await import('./auth.ts');const service=createAuthService(db,async()=>{});for(let i=0;i<10;i++)await service.requestCode(`rate-${i}@example.test`,'different-test-ip');await assert.rejects(()=>service.requestCode('rate-limit@example.test','different-test-ip'),error=>error instanceof ServiceError&&error.status===429);
    });
  }finally{workflowMock.mock.restore();mailMock.mock.restore();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await db.$disconnect();for(const suffix of ['','-wal','-shm','-journal'])await unlink(file+suffix).catch(()=>undefined);}
});
