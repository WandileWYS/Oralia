import JSZip from 'jszip';
import {Readable} from 'node:stream';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {db} from '../db.ts';
import {ServiceError} from '../errors.ts';
import {appOrigin} from '../config.ts';
import {sendEmail} from '../providers/email.ts';
import {downloadUrl,inspectAsset,removeAsset} from '../providers/storage.ts';
import {foundryInputSchema,foundryPlanSchema} from '../../src/types/foundry.ts';
import {snapshotSchema} from '../../src/types/creation.ts';
import {archiveLimit,ownedFoundry} from './service.ts';

async function *mediaStream(publicId:string,format:string,kind:string,limit:number){let response:Response;try{response=await fetch(downloadUrl(publicId,format,kind),{signal:AbortSignal.timeout(120000)});}catch{throw new ServiceError('ARCHIVE_MEDIA_READ',503,'Archive media download failed.',true);}if(!response.ok||!response.body)throw new ServiceError('ARCHIVE_MEDIA_READ',503,'Archive source media is unavailable.',true);let length=0;const hash=createHash('sha256');for await(const chunk of Readable.fromWeb(response.body as import('node:stream/web').ReadableStream<Uint8Array>)){const bytes=Buffer.from(chunk as Uint8Array);length+=bytes.length;if(length>limit)throw new ServiceError('ARCHIVE_MEDIA_READ',413,'An archive source exceeds its size limit.');hash.update(bytes);yield bytes;}return hash.digest('hex');}
export async function verifyArchive(publicId:string,limit:number,expected?:{bytes:number;checksum:string}){let length=0;let tail=Buffer.alloc(0);const hash=createHash('sha256');for await(const chunk of mediaStream(publicId,'zip','raw',limit)){length+=chunk.length;hash.update(chunk);tail=Buffer.concat([tail,chunk]).subarray(-65557);}const end=tail.lastIndexOf(Buffer.from('504b0506','hex'));if(end<0||end+22>tail.length||end+22+tail.readUInt16LE(end+20)!==tail.length||expected&&(expected.bytes!==length||expected.checksum!==hash.digest('hex')))throw new ServiceError('ARCHIVE_VERIFY_FAILED',503,'The archive download failed integrity verification.',true);return length;}
// ZIP buffers never exceed the account allowance or 9 MiB. Media bytes remain streamed.
const MiB=1024*1024;
interface Entry {filename:string;publicId?:string;format?:string;kind?:string;offset:number;length:number;checksum:string;wholeChecksum:string;sourceFilename:string;sourceBytes:number;inline?:string}
interface PartPlan {manifest:unknown;entries:Entry[];inventory:{partNumber:number;filename:string;entries:string[]}[]}
const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
async function sourceForExport(id:string){
 const record=await db.storyExport.findUniqueOrThrow({where:{id}});const jobId=record.versionId.startsWith('foundry:')?record.versionId.slice(8):null;
 const zip=new JSZip();let manifest:unknown;let audio:{publicId:string;filename:string}|null=null;let scenes:{publicId:string;filename:string}[]=[];
   if(jobId){const job=await ownedFoundry(record.userId,jobId);const input=foundryInputSchema.parse(JSON.parse(job.inputJson));const plan=foundryPlanSchema.parse(JSON.parse(job.planJson!));const assets=await db.mediaAsset.findMany({where:{jobId,status:'READY'}});
    scenes=plan.scenes.map((scene,index)=>{const asset=assets.find(a=>a.slot===`FOUNDRY_IMAGE_${index}`);if(!asset)throw new ServiceError('ARCHIVE_MEDIA_READ',409,'A scene image is missing.');return {...scene,publicId:asset.publicId,filename:`images/scene-${String(index+1).padStart(3,'0')}.png`};});
    if(!input.bypassTts){const asset=assets.find(a=>a.slot==='FOUNDRY_NARRATION');if(!asset)throw new ServiceError('ARCHIVE_MEDIA_READ',409,'Narration is missing.');audio={publicId:asset.publicId,filename:'narration.wav'};}
    manifest={schemaVersion:'oralia-foundry-assets-v2',title:plan.polishedTitle||input.title,collection:input.collection,language:plan.language||input.language,provenance:input.provenance,timing:plan.timing,bypassTts:input.bypassTts,references:input.references,scenes:scenes.map((scene,index)=>({...scene,sceneNumber:index+1})),audio:audio?{filename:audio.filename}:null};
    zip.file('original-script.txt',input.script,{compression:'DEFLATE'});zip.file('script.txt',plan.localizedScript||plan.scenes.map(s=>s.narration).join('\n\n'),{compression:'DEFLATE'});zip.file('timeline.json',JSON.stringify(plan,null,2),{compression:'DEFLATE'});zip.file('timeline.txt',plan.scenes.map((scene,i)=>`${i+1}. ${time(scene.startSeconds)} – ${time(scene.endSeconds)} [${plan.timing}]\n${scene.narration}\n${scene.imagePrompt}`).join('\n\n'),{compression:'DEFLATE'});
   }else{const version=await db.storyVersion.findFirst({where:{id:record.versionId,userId:record.userId}});if(!version)throw new ServiceError('NOT_FOUND',404,'Original export source not found.');const snapshot=snapshotSchema.parse(JSON.parse(version.snapshotJson));scenes=snapshot.scenes.map((scene,i)=>({...scene,filename:`images/scene-${String(i+1).padStart(3,'0')}.png`}));audio={publicId:snapshot.audio.publicId,filename:'narration.wav'};manifest={schemaVersion:'oralia-foundry-assets-v2',legacyVersionId:version.id,timing:'audio_measured',title:snapshot.plan.polishedTitle||snapshot.input.title,language:snapshot.plan.language||snapshot.input.language,collection:snapshot.input.collection,provenance:snapshot.input.provenance,scenes,audio:{filename:'narration.wav'}};zip.file('script.txt',snapshot.plan.polishedText,{compression:'DEFLATE'});zip.file('timeline.json',JSON.stringify(snapshot.scenes,null,2),{compression:'DEFLATE'});zip.file('timeline.txt',snapshot.scenes.map((s,i)=>`${i+1}. ${time(s.startTime)} – ${time(s.endTime)}\n${s.narration}`).join('\n\n'),{compression:'DEFLATE'});}

 const text: {filename:string;bytes:Buffer}[]=[];
 for(const file of Object.values(zip.files))if(!file.dir)text.push({filename:file.name,bytes:await file.async('nodebuffer')});
 return {record,jobId,manifest,text,media:[...scenes.map(s=>({...s,kind:'image',format:'png'})),...(audio?[{...audio,kind:'video',format:'wav'}]:[])]};
}
async function *entryStream(entry:Entry){
 if(entry.inline!==undefined){yield Buffer.from(entry.inline,'utf8');return;}
 let response:Response;try{response=await fetch(downloadUrl(entry.publicId!,entry.format!,entry.kind!),{signal:AbortSignal.timeout(120000),headers:{Range:`bytes=${entry.offset}-${entry.offset+entry.length-1}`}});}catch{throw new ServiceError('ARCHIVE_MEDIA_READ',503,'Archive source download failed.',true);}
 if(!response.ok||!response.body)throw new ServiceError('ARCHIVE_MEDIA_READ',503,'Archive source is unavailable.',true);
 if(response.status===206&&response.headers.get('content-range')!==`bytes ${entry.offset}-${entry.offset+entry.length-1}/${entry.sourceBytes}`)throw new ServiceError('ARCHIVE_MEDIA_READ',503,'Source range did not match the planned asset.');
 let position=response.status===206?entry.offset:0;let received=0;const hash=createHash('sha256');
 for await(const raw of Readable.fromWeb(response.body as import('node:stream/web').ReadableStream<Uint8Array>)){
  const chunk=Buffer.from(raw as Uint8Array);const from=Math.max(0,entry.offset-position);const to=Math.min(chunk.length,entry.offset+entry.length-position);position+=chunk.length;
  if(to>from){const bytes=chunk.subarray(from,to);received+=bytes.length;hash.update(bytes);yield bytes;}
  if(received===entry.length)break;
 }
 if(received!==entry.length||hash.digest('hex')!==entry.checksum)throw new ServiceError('ARCHIVE_MEDIA_READ',503,'Archive source checksum/length changed.');
}
export const reconstructionReadme=`Oralia private production assets
Extract every ZIP into the same directory. Regular files are ready to use.
Files named .chunk-0001 etc are exact byte chunks, not playable audio or images.
Read manifest.json for the original filename, ordered chunks and SHA-256 checksums.
Reassemble each original file in exactly the listed order. Do not use text concatenation.
PowerShell example (replace paths with the manifest filenames):
$out=[IO.File]::Create('narration.wav'); try { foreach($p in @('narration.wav.chunk-0001','narration.wav.chunk-0002')) { $in=[IO.File]::OpenRead($p); try { $in.CopyTo($out) } finally { $in.Dispose() } } } finally { $out.Dispose() }
Verify: Get-FileHash narration.wav -Algorithm SHA256
macOS/Linux example: cat narration.wav.chunk-0001 narration.wav.chunk-0002 > narration.wav
Verify: shasum -a 256 narration.wav
Never concatenate ZIP files. Original reference uploads are not included.
`;
async function buildPart(plan:PartPlan,limit:number){
 const zip=new JSZip();const inputs:Readable[]=[];for(const entry of plan.entries){const input=Readable.from(entryStream(entry));inputs.push(input);zip.file(entry.filename,input,{date:new Date(2000,0,1),compression:entry.filename.endsWith('.png')||entry.filename.includes('.png.chunk-')?'STORE':'DEFLATE',compressionOptions:{level:6}});}
 zip.file('manifest.json',JSON.stringify({...(plan.manifest as object),schemaVersion:'oralia-foundry-assets-v2',parts:plan.inventory,entries:plan.entries.map(({inline:_inline,...entry})=>entry)},null,2),{date:new Date(2000,0,1)});
 zip.file('checksums.json',JSON.stringify(plan.entries.map(e=>({filename:e.filename,sha256:e.checksum})),null,2),{date:new Date(2000,0,1)});zip.file('README.txt',reconstructionReadme,{date:new Date(2000,0,1)});
 const stream=new Readable().wrap(zip.generateNodeStream({streamFiles:true,compression:'DEFLATE',compressionOptions:{level:6}}));const chunks:Buffer[]=[];let bytes=0;
 try{for await(const chunk of stream){bytes+=chunk.length;if(bytes>limit)throw new ServiceError('PART_TOO_LARGE',409,'ZIP needs smaller parts.');chunks.push(Buffer.from(chunk));}return Buffer.concat(chunks);}finally{stream.destroy();inputs.forEach(input=>input.destroy());}
}
async function archiveFailure(id:string,error:unknown){const failure=error instanceof ServiceError?error:new ServiceError('ARCHIVE_UPLOAD',503,'Archive processing failed.',true);await db.storyExport.updateMany({where:{id,status:{not:'READY'}},data:{status:'FAILED',errorCode:failure.code}});const row=await db.storyExport.findUniqueOrThrow({where:{id}});if(row.versionId.startsWith('foundry:'))await db.creationJob.updateMany({where:{id:row.versionId.slice(8),status:{not:'COMPLETED'}},data:{status:'FAILED',stage:'packaging',errorCode:failure.code,retryable:true}});return failure;}
export async function prepareFoundryExport(id:string){
 try{
 const existing=await db.storyExport.findUniqueOrThrow({where:{id},include:{parts:true}});if(existing.status==='READY'&&existing.assetPublicId)return [];
 if(existing.parts.length)return existing.parts.sort((a,b)=>a.partNumber-b.partNumber).map(p=>p.partNumber);
 await db.storyExport.update({where:{id},data:{status:'BUILDING',errorCode:null}});
 const limit=Math.min(9*MiB,await archiveLimit());if(limit<MiB)throw new ServiceError('ARCHIVE_CAPACITY',409,'Cloudinary raw-file allowance is too small.');
 const source=await sourceForExport(id);const chunkSize=Math.min(4*MiB,Math.floor((limit-512*1024)/2));const full:Entry[]=[];const split:Entry[]=[];
 for(const file of source.text){const checksum=digest(file.bytes);const entry={filename:file.filename,sourceFilename:file.filename,sourceBytes:file.bytes.length,offset:0,length:file.bytes.length,checksum,wholeChecksum:checksum,inline:file.bytes.toString('utf8')};full.push(entry);split.push(entry);}
 for(const file of source.media){const chunks:{offset:number;length:number;checksum:string}[]=[];const hash=createHash('sha256');let pending=Buffer.alloc(0);let length=0;
  for await(const bytes of mediaStream(file.publicId,file.format,file.kind,file.kind==='image'?20*MiB:100*MiB)){hash.update(bytes);pending=Buffer.concat([pending,bytes]);while(pending.length>=chunkSize){chunks.push({offset:length,length:chunkSize,checksum:digest(pending.subarray(0,chunkSize))});length+=chunkSize;pending=pending.subarray(chunkSize);}}
  if(pending.length){chunks.push({offset:length,length:pending.length,checksum:digest(pending)});length+=pending.length;}
  if(!length)throw new ServiceError('ARCHIVE_MEDIA_READ',503,'Empty source media.');const checksum=hash.digest('hex');const base={filename:file.filename,sourceFilename:file.filename,sourceBytes:length,publicId:file.publicId,format:file.format,kind:file.kind,offset:0,length,checksum,wholeChecksum:checksum};full.push(base);
  if(length<=chunkSize)split.push(base);else chunks.forEach((chunk,i)=>split.push({...base,...chunk,filename:file.filename+'.chunk-'+String(i+1).padStart(4,'0')}));
 }
 let groups:Entry[][]=[full];const inventory=(values:Entry[][])=>values.map((entries,i)=>({partNumber:i+1,filename:values.length===1?'foundry-export.zip':`foundry-export-part${i+1}.zip`,entries:entries.map(e=>e.filename)}));
 try{await buildPart({manifest:source.manifest,entries:full,inventory:inventory(groups)},limit);}catch(error){if(!(error instanceof ServiceError)||error.code!=='PART_TOO_LARGE')throw error;
  groups=[];let group:Entry[]=[];let bytes=0;for(const entry of split){if(group.length&&bytes+entry.length>limit-512*1024){groups.push(group);group=[];bytes=0;}group.push(entry);bytes+=entry.length;}if(group.length)groups.push(group);
 }
 const list=inventory(groups);
 await db.$transaction(async tx=>{for(const [index,entries]of groups.entries()){await tx.exportPart.upsert({where:{exportId_partNumber:{exportId:id,partNumber:index+1}},create:{exportId:id,partNumber:index+1,filename:list[index].filename,publicId:`oralia/foundry/exports/${source.record.userId}/${id}/part-${index+1}.zip`,entriesJson:JSON.stringify({manifest:source.manifest,entries,inventory:list})},update:{}});}}, {maxWait:10000,timeout:60000});
 return list.map(p=>p.partNumber);
 }catch(error){throw await archiveFailure(id,error);}
}
export async function packageFoundryPart(id:string,partNumber:number){
 try{
 const row=await db.exportPart.findUniqueOrThrow({where:{exportId_partNumber:{exportId:id,partNumber}}});const limit=Math.min(9*MiB,await archiveLimit());
 if(row.status==='READY'&&row.bytes&&row.checksum){await verifyArchive(row.publicId,limit,{bytes:row.bytes,checksum:row.checksum});return;}
 const bytes=await buildPart(JSON.parse(row.entriesJson) as PartPlan,limit);const checksum=digest(bytes);
 // Deterministic owned IDs and checksum verification recover an interrupted upload.
 let recovered=false;try{await verifyArchive(row.publicId,limit,{bytes:bytes.length,checksum});recovered=true;}catch{/* Not uploaded or incomplete. */}
 if(!recovered){try{await inspectAsset(row.publicId,'raw');await removeAsset(row.publicId,'raw');}catch{/* No reserved asset yet. */}
  const {storeBytes}=await import('../providers/storage.ts');try{await storeBytes(bytes,row.publicId,'raw','zip');}catch{throw new ServiceError('ARCHIVE_UPLOAD',503,'Archive part upload was not confirmed.',true);}
 }
 await verifyArchive(row.publicId,limit,{bytes:bytes.length,checksum});await db.exportPart.update({where:{id:row.id},data:{status:'READY',bytes:bytes.length,checksum}});
 }catch(error){throw await archiveFailure(id,error);}
}
export async function finishFoundryExport(id:string){
 const row=await db.storyExport.findUniqueOrThrow({where:{id},include:{parts:true}});if(row.status==='READY'&&row.assetPublicId)return;
 if(!row.parts.length||row.parts.some(p=>p.status!=='READY'))throw new ServiceError('NOT_READY',409,'Every archive part must be verified.');
 await db.$transaction(async tx=>{await tx.storyExport.update({where:{id},data:{status:'READY',assetPublicId:row.parts.length===1?row.parts[0].publicId:null,errorCode:null}});if(row.versionId.startsWith('foundry:')){const job=await tx.creationJob.findUniqueOrThrow({where:{id:row.versionId.slice(8)}});await tx.creationJob.update({where:{id:job.id},data:{status:'COMPLETED',stage:'archive ready',processedScenes:job.totalScenes,errorCode:null,retryable:false}});}});
}
export async function packageFoundryExport(id:string){const parts=await prepareFoundryExport(id);for(const number of parts)await packageFoundryPart(id,number);await finishFoundryExport(id);}
export async function notifyFoundryExport(id:string){const record=await db.storyExport.findUniqueOrThrow({where:{id}});if(record.status!=='READY')throw new ServiceError('NOT_READY',409,'Archive is not ready.');if(record.notificationStatus==='SENT')return;const claim=await db.storyExport.updateMany({where:{id,notificationStatus:{in:['QUEUED','FAILED','NOT_REQUESTED']}},data:{notificationStatus:'SENDING'}});if(!claim.count)return;try{const user=await db.user.findUniqueOrThrow({where:{id:record.userId}});const parts=await db.exportPart.findMany({where:{exportId:id},orderBy:{partNumber:'asc'}});const links=parts.map(p=>`${p.filename} (${p.bytes} bytes): ${appOrigin()}/api/v1/foundry/exports/${encodeURIComponent(id)}/parts/${p.partNumber}/download`).join('\n');await sendEmail(user.email,'Your Studio Foundry asset package is ready',`Sign in to download your private ZIP:\n${appOrigin()}/?foundryExport=${encodeURIComponent(id)}\nThis link requires your verified account.\n\n${links}`);await db.storyExport.update({where:{id},data:{notificationStatus:'SENT',errorCode:null}});}catch{await db.storyExport.update({where:{id},data:{notificationStatus:'FAILED',errorCode:'EMAIL_FAILED'}});throw new ServiceError('EMAIL_FAILED',503,'Your archive is ready, but its email failed.',true);}}
function time(seconds:number){return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${(seconds%60).toFixed(3).padStart(6,'0')}`;}
export const retryBody=z.object({requestKey:z.string().uuid()}).strict();
