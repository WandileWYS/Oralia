import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createClient } from '@libsql/client';
import nodemailer from 'nodemailer';
import { assembleNarration, pcmToWave, readWavePcm } from './audio.ts';
import { inputSchema, polishedPlanSchema } from '../src/types/creation.ts';
import { generateImage, polish, synthesizeNarration, transcribe } from './providers/ai.ts';
import { ServiceError } from './errors.ts';
import { mailTransport, sendEmail } from './providers/email.ts';

const input={title:'The river',text:'A traveler learns to listen.',collection:'FOLK_AND_FABLE' as const,region:'originals' as const,language:'en',provenance:'Written by the submitting author.'};
const scenes=[0,1,2,3].map(index=>({title:`Scene ${index+1}`,narration:`Narration ${index+1}.`,imagePrompt:`A detailed illustration for scene ${index+1}.`,proposedStartSeconds:index*6}));
const plan={polishedTitle:'Lessons beside the river',language:'en',polishedText:scenes.map(scene=>scene.narration).join('\n\n'),scenes};

test('production migration preserves stories, scenes, accounts and bookmarks while revoking old credentials',async()=>{
  await mkdir('.qa',{recursive:true});const file=`.qa/production-migration-${randomUUID()}.db`;const sql=createClient({url:'file:./'+file});
  try{
    for(const name of ['20261105000000_init','20261106000000_thematic_collections'])await sql.executeMultiple(await readFile(`prisma/migrations/${name}/migration.sql`,'utf8'));
    await sql.execute("INSERT INTO User(id,name,username,email,avatarUrl,bio) VALUES ('author','Author','author','author@example.test','/avatar.svg','Bio')");
    await sql.execute("INSERT INTO Story(id,title,description,collection,regionTag,audioUrl,duration,authorId,sourceTitle,sourceUrl,culturalNote) VALUES ('story','Story','Description','FOLK_AND_FABLE','originals','/media/test.wav',20,'author','Source','https://example.test','Note')");
    await sql.execute("INSERT INTO KeyframeScene(id,storyId,sceneNumber,title,narrationText,imageUrl,timestamp,imageCredit,imageSourceUrl) VALUES ('scene','story',1,'Scene','Narration','https://example.test/image',0,'Credit','https://example.test')");
    await sql.execute("INSERT INTO Bookmark(id,userId,storyId) VALUES ('bookmark','author','story')");await sql.execute("INSERT INTO Session(id,userId,expiresAt) VALUES ('legacy','author','2030-01-01')");await sql.execute("INSERT INTO OtpChallenge(id,email,expiresAt) VALUES ('legacy-code','author@example.test','2030-01-01')");
    await sql.executeMultiple(await readFile('prisma/migrations/20261107000000_production_pipeline/migration.sql','utf8'));
    assert.equal((await sql.execute('SELECT COUNT(*) AS n FROM Session')).rows[0].n,0);assert.equal((await sql.execute('SELECT COUNT(*) AS n FROM OtpChallenge')).rows[0].n,0);
    for(const table of ['User','Story','KeyframeScene','Bookmark'])assert.equal((await sql.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n,1);
    await sql.execute("INSERT INTO StoryExport(id,userId,versionId,status,assetPublicId) VALUES ('legacy-export','author','legacy-version','READY','old/archive.zip')");
    await sql.executeMultiple(await readFile('prisma/migrations/20261109000000_dynamic_scenes/migration.sql','utf8'));
    await sql.executeMultiple(await readFile('prisma/migrations/20261109120000_localized_multipart/migration.sql','utf8'));
    assert.equal((await sql.execute("SELECT assetPublicId FROM StoryExport WHERE id='legacy-export'")).rows[0].assetPublicId,'old/archive.zip');assert.equal((await sql.execute('SELECT COUNT(*) AS n FROM ExportPart')).rows[0].n,0);assert.ok((await sql.execute('PRAGMA index_list(Story)')).rows.some(row=>row.name==='Story_language_collection_publishedAt_idx'));
    assert.equal((await sql.execute('SELECT emailVerifiedAt FROM User')).rows[0].emailVerifiedAt,null);assert.equal((await sql.execute('SELECT provenance FROM Story')).rows[0].provenance,'LEGACY_EDITORIAL');assert.equal((await sql.execute('PRAGMA foreign_key_check')).rows.length,0);
  }finally{sql.close();await unlink(file).catch(()=>undefined);}
});
test('measured PCM boundaries, not proposed model estimates, determine final narration timing',()=>{
  const pcm=[24000,48000,12000,36000].map(samples=>Buffer.alloc(samples*2));const result=assembleNarration(pcm);
  assert.deepEqual(result.boundaries.map(frame=>[frame.startTime,frame.endTime]),[[0,1],[1,3],[3,3.5],[3.5,5]]);assert.equal(result.duration,5);assert.deepEqual(readWavePcm(result.bytes),Buffer.concat(pcm));assert.deepEqual(readWavePcm(pcmToWave(pcm[0])),pcm[0]);assert.throws(()=>readWavePcm(Buffer.from('not audio')));assert.throws(()=>assembleNarration([Buffer.alloc(3)]));
});
test('creation contracts reject unsupported collections, oversized submissions and inconsistent model output',()=>{
  assert.ok(inputSchema.safeParse(input).success);assert.ok(!inputSchema.safeParse({...input,text:'x'.repeat(12001)}).success);assert.ok(!inputSchema.safeParse({...input,sourceAssetId:'other'}).success);assert.ok(!inputSchema.safeParse({...input,collection:'ALL'}).success);
  for(const count of [1,4,16,24,64]){const dynamic=Array.from({length:count},(_,i)=>({...scenes[0],narration:'Scene '+i+'.',proposedStartSeconds:i*20}));assert.ok(polishedPlanSchema.safeParse({polishedText:dynamic.map(s=>s.narration).join('\n\n'),scenes:dynamic}).success);assert.equal(assembleNarration(dynamic.map(()=>Buffer.alloc(48000))).boundaries.length,count);}
  assert.ok(polishedPlanSchema.safeParse(plan).success);assert.ok(!polishedPlanSchema.safeParse({...plan,polishedText:'Unrelated story'}).success);assert.ok(!polishedPlanSchema.safeParse({...plan,scenes:[...scenes].reverse()}).success);
});
test('real provider adapters validate transcripts, strict Gemini JSON, PCM and image bytes',async()=>{
  const original=globalThis.fetch;const old=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='unit-test-key';const oldGemini=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='unit-test-key';
  const seen:string[]=[];
  globalThis.fetch=async(url,options)=>{
    seen.push(String(url));
    if(String(url).endsWith('/audio/transcriptions'))return Response.json({text:'A real transcript returned by the provider fixture.'});
    if(String(url).includes(':generateContent')){assert.match(String(url),/gemini-3\.5-flash-lite/);assert.ok(JSON.parse(String(options?.body)).generationConfig.responseJsonSchema);return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(plan)}]}}]});}
    if(String(url).endsWith('/audio/speech')){const body=JSON.parse(String(options?.body));assert.equal(body.model,'tts-1-hd');assert.equal(body.response_format,'pcm');return new Response(new Uint8Array(960),{headers:{'Content-Type':'audio/pcm'}});}
    return Response.json({data:[{b64_json:Buffer.from([137,80,78,71,13,10,26,10]).toString('base64')}]});
  };
  try{assert.match(await transcribe(Buffer.alloc(44),'wav'),/transcript/);assert.deepEqual(await polish('Transcript',input),plan);assert.equal((await synthesizeNarration('Narration')).length,960);assert.equal((await generateImage('Scene')).length,8);assert.equal(seen.length,4);}
  finally{globalThis.fetch=original;if(old===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=old;if(oldGemini===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldGemini;}
});
test('missing credentials and ambiguous paid failures never produce fallback content',async()=>{
  const original=globalThis.fetch;const old=process.env.OPENAI_API_KEY;
  try{
    delete process.env.OPENAI_API_KEY;await assert.rejects(()=>generateImage('Scene'),error=>error instanceof ServiceError&&error.code==='CONFIGURATION_MISSING');
    process.env.OPENAI_API_KEY='unit-test';globalThis.fetch=async()=>{throw new Error('Private request details');};await assert.rejects(()=>generateImage('Scene'),error=>error instanceof ServiceError&&error.indeterminate&&!error.retryable);
    globalThis.fetch=async()=>new Response('',{status:429});await assert.rejects(()=>generateImage('Scene'),error=>error instanceof ServiceError&&error.retryable&&!error.indeterminate);
    globalThis.fetch=async()=>Response.json({data:[]});await assert.rejects(()=>generateImage('Scene'),error=>error instanceof ServiceError&&error.code==='IMAGE_INVALID');
    globalThis.fetch=async()=>new Response('<html>Gateway failure</html>');await assert.rejects(()=>generateImage('Scene'),error=>error instanceof ServiceError&&error.code==='PROVIDER_RESPONSE_INVALID'&&!error.retryable);
    globalThis.fetch=async()=>Response.json({text:''});await assert.rejects(()=>transcribe(Buffer.alloc(44),'wav'),error=>error instanceof ServiceError&&error.code==='TRANSCRIPT_INVALID'&&!error.retryable);
    globalThis.fetch=async()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'not json'}]}}]});await assert.rejects(()=>polish('Story',input),error=>error instanceof ServiceError&&error.code==='GEMINI_RESPONSE_INVALID');
  }finally{globalThis.fetch=original;if(old===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=old;}
});
test('SMTP requires STARTTLS and rejects failed dispatch without leaking credentials',async()=>{
  const previous={...process.env};Object.assign(process.env,{SMTP_HOST:'smtp.gmail.com',SMTP_PORT:'587',SMTP_USER:'test@example.test',SMTP_PASSWORD:'private-test-only'});
  let options:unknown;const transport=mock.method(nodemailer,'createTransport',(value:unknown)=>{options=value;return {sendMail:async()=>{throw new Error('private-test-only');},close(){}} as unknown as ReturnType<typeof nodemailer.createTransport>;});
  try{mailTransport().close();assert.equal((options as {requireTLS:boolean}).requireTLS,true);assert.equal((options as {secure:boolean}).secure,false);await assert.rejects(()=>sendEmail('test@example.test','Subject','Message'),error=>error instanceof ServiceError&&error.code==='SMTP_UNAVAILABLE'&&!error.message.includes('private-test-only'));}
  finally{transport.mock.restore();for(const key of ['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASSWORD']){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}}
});


test('localized Gemini titles require target language and preserve the original submission',async()=>{
 const previous=globalThis.fetch;const old=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='unit-only';
 try{
  for(const language of ['en','zu','xh','sw','yo','ha','af','fr','pt']){
   const submission={...input,title:'',language};const original=JSON.stringify(submission);
   const output={polishedTitle:'A title chosen from the narrative',language,scenes};
   globalThis.fetch=async(_url,options)=>{const request=JSON.parse(String(options?.body));const payload=JSON.parse(request.contents[0].parts[0].text);assert.equal(payload.title,'');assert.equal(payload.language,language);assert.ok(request.generationConfig.responseJsonSchema.required.includes('polishedTitle'));return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(output)}]}}]});};
   const result=await polish('Original words',submission);assert.equal(result.polishedTitle,output.polishedTitle);assert.equal(result.language,language);assert.equal(JSON.stringify(submission),original);
  }
  for(const output of [{scenes},{polishedTitle:'',language:'en',scenes},{polishedTitle:'Title',language:'zu',scenes}]){globalThis.fetch=async()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(output)}]}}]});await assert.rejects(()=>polish('Original',input),error=>error instanceof ServiceError&&error.code==='GEMINI_RESPONSE_INVALID');}
 }finally{globalThis.fetch=previous;if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old;}
});
