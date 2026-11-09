import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { readFile, mkdir, unlink } from 'node:fs/promises';
import { createClient } from '@libsql/client';
import { v2 as cloudinary, type UploadApiOptions, type UploadResponseCallback } from 'cloudinary';
import nodemailer from 'nodemailer';
import JSZip from 'jszip';

test('persisted pipeline completes exact media timing, reviewed publication and recoverable export notification',async()=>{
  await mkdir('.qa',{recursive:true});const file=`.qa/pipeline-${randomUUID()}.db`;const sql=createClient({url:'file:./'+file});
  for(const name of ['20261105000000_init','20261106000000_thematic_collections','20261107000000_production_pipeline','20261109000000_dynamic_scenes','20261109120000_localized_multipart'])await sql.executeMultiple(await readFile(`prisma/migrations/${name}/migration.sql`,'utf8'));sql.close();
  Object.assign(process.env,{DATABASE_URL:'file:./'+file,OPENAI_API_KEY:'unit-test',GEMINI_API_KEY:'unit-test',CLOUDINARY_CLOUD_NAME:'unit-test',CLOUDINARY_API_KEY:'unit-test',CLOUDINARY_API_SECRET:'unit-test',APP_ORIGIN:'http://localhost',SMTP_HOST:'smtp.example.test',SMTP_PORT:'587',SMTP_USER:'unit@example.test',SMTP_PASSWORD:'unit-test'});delete process.env.VERCEL;
  const {db}=await import('./db.ts');const pipeline=await import('./pipeline.ts');const {createJob,retryJob,reviseJob}=await import('./creation.ts');const {publishVersion}=await import('./publication.ts');const {createExport,packageVersion,notifyExport}=await import('./exports.ts');const {readCatalog}=await import('./catalog.ts');const {ServiceError}=await import('./errors.ts');
  type Stored={bytes:Buffer;metadata:{public_id:string;asset_id:string;resource_type:string;type:string;format:string;bytes:number;duration?:number}};
  const media=new Map<string,Stored>();let images=0;let voices=0;let uploadCount=0;let mailCount=0;let rejectMail=false;let unknownVoice=false;
  const upload=mock.method(cloudinary.uploader,'upload_stream',(...args:unknown[])=>{
    const options=args[0] as UploadApiOptions;const callback=args[1] as UploadResponseCallback;const chunks:Buffer[]=[];
    return new Writable({write(chunk,_encoding,done){chunks.push(Buffer.from(chunk));done();},final(done){const bytes=Buffer.concat(chunks);const metadata={public_id:String(options.public_id),asset_id:randomUUID(),resource_type:String(options.resource_type),type:String(options.type),format:String(options.format),bytes:bytes.length,...(options.resource_type==='video'?{duration:(bytes.length-44)/48000}:{})};media.set(`${metadata.type}:${metadata.resource_type}:${metadata.public_id}`,{bytes,metadata});uploadCount++;callback(undefined,metadata as unknown as Parameters<UploadResponseCallback>[1]);done();}}) as unknown as ReturnType<typeof cloudinary.uploader.upload_stream>;
  });
  const inspect=mock.method(cloudinary.api,'resource',async(...args:unknown[])=>{const [id,options]=args as [string,{resource_type:string;type:string;media_metadata?:boolean}];if(options.resource_type==='video')assert.equal(options.media_metadata,true,'Audio inspection must request duration metadata');const stored=media.get(`${options.type}:${options.resource_type}:${id}`);if(!stored)throw new Error('No asset');return stored.metadata;});
  const mail=mock.method(nodemailer,'createTransport',()=>({async sendMail(){if(rejectMail)throw new Error('SMTP fixture unavailable');mailCount++;return {accepted:['unit@example.test']};},close(){}} as unknown as ReturnType<typeof nodemailer.createTransport>));
  const originalFetch=globalThis.fetch;
  const scenes=[0,1,2,3,4,5].map(index=>({title:`Scene ${index+1}`,narration:`The river teaches lesson ${index+1}.`,imagePrompt:`Illustrate an original riverside scene ${index+1}.`,proposedStartSeconds:index*20}));const plan={polishedTitle:'Lessons beside the river',language:'en',polishedText:scenes.map(scene=>scene.narration).join('\n\n'),scenes};
  globalThis.fetch=async(url,options)=>{
    const address=String(url);
    if(address.includes(':generateContent'))return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(plan)}]}}]});
    if(address.endsWith('/audio/speech')){voices++;if(unknownVoice)throw new Error('Connection lost after provider accepted input');const {pcmToWave}=await import('./audio.ts');return new Response(new Uint8Array(JSON.parse(String(options?.body)).response_format==='wav'?pcmToWave(Buffer.alloc(48000)):Buffer.alloc(48000)));}
    if(address.endsWith('/images/generations')){images++;return Response.json({data:[{b64_json:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5NsAAAAASUVORK5CYII='}]});}
    const query=new URL(address).searchParams;const id=query.get('public_id');const kind=query.get('resource_type')|| (address.includes('/video/')?'video':address.includes('/raw/')?'raw':'image');
    const stored=[...media.values()].find(value=>value.metadata.public_id===id&&(value.metadata.resource_type===kind||!query.has('resource_type')));
    if(!stored)return new Response('',{status:404});return new Response(new Uint8Array(stored.bytes),{headers:{'Content-Length':String(stored.bytes.length)}});
  };
  try{
    const user=await db.user.create({data:{name:'Creator',username:'creator',email:'creator@example.test',avatarUrl:'/favicon.svg',bio:'Bio',role:'CREATOR',emailVerifiedAt:new Date()}});
    const input={title:'An original river tale',text:'A traveler learns to listen beside a river.',collection:'FOLK_AND_FABLE',region:'originals',language:'en',provenance:'Original submission with permission.'};
    const job=await createJob(user.id,input,randomUUID());await pipeline.transcriptStage(job.id);await pipeline.polishStage(job.id);for(let start=0;start<6;start+=2)await pipeline.mediaBatch(job.id,start);assert.equal((await db.creationJob.findUniqueOrThrow({where:{id:job.id}})).processedScenes,6);await pipeline.finalizeStage(job.id);
    assert.equal((await db.creationJob.findUniqueOrThrow({where:{id:job.id}})).status,'COMPLETED');assert.equal((await readCatalog()).stories.length,0);assert.equal(images,6);assert.equal(voices,6);
    const version=await db.storyVersion.findUniqueOrThrow({where:{jobId:job.id}});const snapshot=JSON.parse(version.snapshotJson);assert.deepEqual(snapshot.scenes.map((scene:{startTime:number})=>scene.startTime),[0,1,2,3,4,5]);assert.equal(snapshot.audio.duration,6);
    await pipeline.narrationStage(job.id,0);await pipeline.imageStage(job.id,0);await pipeline.finalizeStage(job.id);assert.equal(images,6);assert.equal(voices,6);assert.equal(await db.storyVersion.count(),1);
    await assert.rejects(()=>publishVersion(version.id,'not-the-owner'),error=>error instanceof ServiceError&&error.status===404);
    await publishVersion(version.id,user.id);const published=(await readCatalog()).stories[0];assert.equal(published.id,job.storyId);assert.equal(published.title,plan.polishedTitle);assert.equal(published.audio.language,'en');assert.equal(published.audio.durationSeconds,6);assert.equal(published.presentation.keyframes[3].startTime,3);assert.ok(published.presentation.keyframes.every(frame=>frame.altText.includes('AI-generated')));assert.equal(published.sourceUrl,undefined);assert.equal(published.category,'Original Narrative');
    const archive=await createExport(user.id,version.id);await packageVersion(archive.id);const afterPackage=uploadCount;await packageVersion(archive.id);assert.equal(uploadCount,afterPackage);const record=await db.storyExport.findUniqueOrThrow({where:{id:archive.id}});assert.equal(record.status,'READY');
    const bundle=await JSZip.loadAsync(media.get(`authenticated:raw:${record.assetPublicId}`)!.bytes);const manifest=JSON.parse(await bundle.file('manifest.json')!.async('string'));assert.equal(manifest.versionId,version.id);assert.equal(manifest.scenes.length,6);assert.equal(manifest.audio.duration,6);assert.ok(bundle.file('narration.wav'));
    rejectMail=true;await assert.rejects(()=>notifyExport(archive.id));assert.equal((await db.storyExport.findUniqueOrThrow({where:{id:archive.id}})).status,'READY');assert.equal((await db.storyExport.findUniqueOrThrow({where:{id:archive.id}})).notificationStatus,'FAILED');rejectMail=false;await notifyExport(archive.id);await notifyExport(archive.id);assert.equal(mailCount,1);assert.equal(uploadCount,afterPackage);
    const {notifyCreation}=await import('./creationNotification.ts');rejectMail=true;await assert.rejects(()=>notifyCreation(job.id));assert.equal((await db.creationJob.findUniqueOrThrow({where:{id:job.id}})).status,'COMPLETED');rejectMail=false;await notifyCreation(job.id);await notifyCreation(job.id);assert.equal(mailCount,2);
    assert.equal((await db.creationJob.findUniqueOrThrow({where:{id:job.id}})).processedScenes,6);
    const unknown=await createJob(user.id,input,randomUUID());await pipeline.transcriptStage(unknown.id);await pipeline.polishStage(unknown.id);unknownVoice=true;let failure:unknown;try{await pipeline.narrationStage(unknown.id,0);}catch(error){failure=error;}assert.ok(failure instanceof ServiceError&&failure.indeterminate);await pipeline.recordFailure(unknown.id,failure);assert.equal((await db.creationJob.findUniqueOrThrow({where:{id:unknown.id}})).status,'INDETERMINATE');await assert.rejects(()=>retryJob(user.id,unknown.id));const paidAttempts=voices;unknownVoice=false;await assert.rejects(()=>pipeline.narrationStage(unknown.id,0));assert.equal(voices,paidAttempts);
    const revision=await reviseJob(user.id,job.id,plan,randomUUID());assert.equal(revision.version,2);assert.equal(revision.planJson,JSON.stringify(plan));assert.equal(await db.mediaAsset.count({where:{jobId:revision.id}}),0);
    await assert.rejects(()=>publishVersion(version.id,user.id),error=>error instanceof ServiceError&&error.code==='VERSION_STALE');
    const narration=await db.mediaAsset.findFirstOrThrow({where:{jobId:job.id,slot:'NARRATION'}});assert.equal(narration.sampleCount,144000);assert.equal(narration.duration,6);
    await db.creationJob.update({where:{id:revision.id},data:{planJson:null,stage:'polishing requested'}});await assert.rejects(()=>pipeline.polishStage(revision.id),error=>error instanceof ServiceError&&error.indeterminate);
  }finally{globalThis.fetch=originalFetch;upload.mock.restore();inspect.mock.restore();mail.mock.restore();await db.$disconnect();await unlink(file).catch(()=>undefined);}
});
