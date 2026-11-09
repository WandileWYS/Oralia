import JSZip from 'jszip';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {db} from '../db.ts';
import {ServiceError} from '../errors.ts';
import {appOrigin} from '../config.ts';
import {sendEmail} from '../providers/email.ts';
import {mediaCloud,downloadUrl,inspectAsset,removeAsset} from '../providers/storage.ts';
import {foundryInputSchema,foundryPlanSchema} from '../../src/types/foundry.ts';
import {snapshotSchema} from '../../src/types/creation.ts';
import {archiveLimit,ownedFoundry} from './service.ts';

async function *mediaStream(publicId:string,format:string,kind:string,limit:number){let response:Response;try{response=await fetch(downloadUrl(publicId,format,kind),{signal:AbortSignal.timeout(120000)});}catch{throw new ServiceError('ARCHIVE_MEDIA_READ',503,'Archive media download failed.',true);}if(!response.ok||!response.body)throw new ServiceError('ARCHIVE_MEDIA_READ',503,'Archive source media is unavailable.',true);let length=0;const hash=createHash('sha256');for await(const chunk of Readable.fromWeb(response.body as import('node:stream/web').ReadableStream<Uint8Array>)){const bytes=Buffer.from(chunk as Uint8Array);length+=bytes.length;if(length>limit)throw new ServiceError('ARCHIVE_MEDIA_READ',413,'An archive source exceeds its size limit.');hash.update(bytes);yield bytes;}return hash.digest('hex');}
export async function verifyArchive(publicId:string,limit:number,expected?:{bytes:number;checksum:string}){let length=0;let tail=Buffer.alloc(0);const hash=createHash('sha256');for await(const chunk of mediaStream(publicId,'zip','raw',limit)){length+=chunk.length;hash.update(chunk);tail=Buffer.concat([tail,chunk]).subarray(-65557);}const end=tail.lastIndexOf(Buffer.from('504b0506','hex'));if(end<0||end+22>tail.length||end+22+tail.readUInt16LE(end+20)!==tail.length||expected&&(expected.bytes!==length||expected.checksum!==hash.digest('hex')))throw new ServiceError('ARCHIVE_VERIFY_FAILED',503,'The archive download failed integrity verification.',true);return length;}
export async function packageFoundryExport(id:string){
 const record=await db.storyExport.findUniqueOrThrow({where:{id}});const foundry=record.versionId.startsWith('foundry:');const jobId=foundry?record.versionId.slice(8):null;
 const publicId=`oralia/foundry/exports/${record.userId}/${id}.zip`;
 if(record.status==='READY'&&record.assetPublicId){if(jobId)await db.creationJob.update({where:{id:jobId},data:{status:'COMPLETED',stage:'archive ready',errorCode:null,retryable:false}});return;}
 await db.storyExport.update({where:{id},data:{status:'BUILDING',errorCode:null}});
 try{
  const limit=await archiveLimit();
  let recovered=false;try{await inspectAsset(publicId,'raw');recovered=true;}catch{/* A reserved export may not have uploaded yet. */}
  if(recovered){try{await verifyArchive(publicId,limit);}catch{await removeAsset(publicId,'raw');recovered=false;}}
  if(!recovered){
   const zip=new JSZip();let manifest:unknown;let audio:{publicId:string;filename:string}|null=null;let scenes:{publicId:string;filename:string}[]=[];const checksums:{filename:string;sha256:string}[]=[];
   if(jobId){const job=await ownedFoundry(record.userId,jobId);const input=foundryInputSchema.parse(JSON.parse(job.inputJson));const plan=foundryPlanSchema.parse(JSON.parse(job.planJson!));const assets=await db.mediaAsset.findMany({where:{jobId,status:'READY'}});
    scenes=plan.scenes.map((scene,index)=>{const asset=assets.find(a=>a.slot===`FOUNDRY_IMAGE_${index}`);if(!asset)throw new ServiceError('ARCHIVE_MEDIA_READ',409,'A scene image is missing.');return {...scene,publicId:asset.publicId,filename:`images/scene-${String(index+1).padStart(3,'0')}.png`};});
    if(!input.bypassTts){const asset=assets.find(a=>a.slot==='FOUNDRY_NARRATION');if(!asset)throw new ServiceError('ARCHIVE_MEDIA_READ',409,'Narration is missing.');audio={publicId:asset.publicId,filename:'narration.wav'};}
    manifest={schemaVersion:'oralia-foundry-assets-v1',title:input.title,collection:input.collection,language:input.language,provenance:input.provenance,timing:plan.timing,bypassTts:input.bypassTts,references:input.references,scenes:scenes.map((scene,index)=>({...scene,sceneNumber:index+1})),audio:audio?{filename:audio.filename}:null};
    zip.file('script.txt',input.script,{compression:'DEFLATE'});zip.file('timeline.json',JSON.stringify(plan,null,2),{compression:'DEFLATE'});zip.file('timeline.txt',plan.scenes.map((scene,i)=>`${i+1}. ${time(scene.startSeconds)} – ${time(scene.endSeconds)} [${plan.timing}]\n${scene.narration}\n${scene.imagePrompt}`).join('\n\n'),{compression:'DEFLATE'});
   }else{const version=await db.storyVersion.findFirst({where:{id:record.versionId,userId:record.userId}});if(!version)throw new ServiceError('NOT_FOUND',404,'Original export source not found.');const snapshot=snapshotSchema.parse(JSON.parse(version.snapshotJson));scenes=snapshot.scenes.map((scene,i)=>({...scene,filename:`images/scene-${String(i+1).padStart(3,'0')}.png`}));audio={publicId:snapshot.audio.publicId,filename:'narration.wav'};manifest={schemaVersion:'oralia-foundry-assets-v1',legacyVersionId:version.id,timing:'audio_measured',title:snapshot.input.title,collection:snapshot.input.collection,provenance:snapshot.input.provenance,scenes,audio:{filename:'narration.wav'}};zip.file('script.txt',snapshot.plan.polishedText,{compression:'DEFLATE'});zip.file('timeline.json',JSON.stringify(snapshot.scenes,null,2),{compression:'DEFLATE'});zip.file('timeline.txt',snapshot.scenes.map((s,i)=>`${i+1}. ${time(s.startTime)} – ${time(s.endTime)}\n${s.narration}`).join('\n\n'),{compression:'DEFLATE'});}
   const add=(filename:string,assetId:string,format:string,kind:string,compression:'STORE'|'DEFLATE')=>{const stream=Readable.from((async function*(){const hash=createHash('sha256');for await(const bytes of mediaStream(assetId,format,kind,kind==='image'?20*1024*1024:100*1024*1024)){hash.update(bytes);yield bytes;}checksums.push({filename,sha256:hash.digest('hex')});})());zip.file(filename,stream,{compression,compressionOptions:{level:6}});};
   for(const scene of scenes)add(scene.filename,scene.publicId,'png','image','STORE');if(audio)add(audio.filename,audio.publicId,'wav','video','DEFLATE');zip.file('manifest.json',JSON.stringify(manifest,null,2),{compression:'DEFLATE'});
   // This final entry is consumed only after preceding media streams finish.
   zip.file('checksums.json',Readable.from((async function*(){yield Buffer.from(JSON.stringify(checksums,null,2));})()),{compression:'DEFLATE'});
   let bytes=0;const hash=createHash('sha256');const meter=new Transform({transform(chunk:Buffer,_encoding,callback){bytes+=chunk.length;if(bytes>limit){callback(new ServiceError('ARCHIVE_CAPACITY',409,'ZIP exceeds Cloudinary raw-file allowance; raise capacity and retry packaging.'));return;}hash.update(chunk);callback(null,chunk);}});
   const stream=zip.generateNodeStream({streamFiles:true,compression:'DEFLATE',compressionOptions:{level:6}});let sink:ReturnType<ReturnType<typeof mediaCloud>['uploader']['upload_stream']>;
   const uploaded=new Promise<void>((resolve,reject)=>{sink=mediaCloud().uploader.upload_stream({public_id:publicId,resource_type:'raw',type:'authenticated',format:'zip',overwrite:false,timeout:240000},(error,result)=>error||!result?reject(new ServiceError('ARCHIVE_UPLOAD',503,'Archive upload failed.',true)):resolve());});
   try{await Promise.all([pipeline(stream,meter,sink!),uploaded]);}catch(error){(stream as Readable).destroy();sink!.destroy();throw error;}
   await verifyArchive(publicId,limit,{bytes,checksum:hash.digest('hex')});
  }
  await db.$transaction(async tx=>{await tx.storyExport.update({where:{id},data:{status:'READY',assetPublicId:publicId,errorCode:null}});if(jobId)await tx.creationJob.update({where:{id:jobId},data:{status:'COMPLETED',stage:'archive ready',processedScenes:(await tx.creationJob.findUniqueOrThrow({where:{id:jobId}})).totalScenes,errorCode:null,retryable:false}});});
 }catch(error){const known=error instanceof ServiceError?error:new ServiceError('ARCHIVE_UPLOAD',503,'Archive processing failed.',true);await db.storyExport.updateMany({where:{id,status:{not:'READY'}},data:{status:'FAILED',errorCode:known.code}});if(jobId)await db.creationJob.updateMany({where:{id:jobId,status:{not:'COMPLETED'}},data:{status:'FAILED',stage:'packaging',errorCode:known.code,retryable:true}});throw known;}
}
export async function notifyFoundryExport(id:string){const record=await db.storyExport.findUniqueOrThrow({where:{id}});if(record.status!=='READY')throw new ServiceError('NOT_READY',409,'Archive is not ready.');if(record.notificationStatus==='SENT')return;const claim=await db.storyExport.updateMany({where:{id,notificationStatus:{in:['QUEUED','FAILED','NOT_REQUESTED']}},data:{notificationStatus:'SENDING'}});if(!claim.count)return;try{const user=await db.user.findUniqueOrThrow({where:{id:record.userId}});await sendEmail(user.email,'Your Studio Foundry asset package is ready',`Sign in to download your private ZIP:\n${appOrigin()}/?foundryExport=${encodeURIComponent(id)}\nThis link requires your verified account.`);await db.storyExport.update({where:{id},data:{notificationStatus:'SENT',errorCode:null}});}catch{await db.storyExport.update({where:{id},data:{notificationStatus:'FAILED',errorCode:'EMAIL_FAILED'}});throw new ServiceError('EMAIL_FAILED',503,'Your archive is ready, but its email failed.',true);}}
function time(seconds:number){return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${(seconds%60).toFixed(3).padStart(6,'0')}`;}
export const retryBody=z.object({requestKey:z.string().uuid()}).strict();
