import { db } from './db.ts';
import { ServiceError } from './errors.ts';
import { parseInput } from './creation.ts';
import { polishedPlanSchema, snapshotSchema, type PolishedPlan } from '../src/types/creation.ts';
import { generateImage, polish, streamNarration, transcribe } from './providers/ai.ts';
import { assetMetadataSchema } from './creation.ts';
import { downloadUrl, inspectAsset, readMedia, storeBytes } from './providers/storage.ts';
import { assembleNarration, readWavePcm } from './audio.ts';

export async function pipelineJob(id:string) {
  const job=await db.creationJob.findUnique({where:{id}});
  if(!job)throw new ServiceError('NOT_FOUND',404,'Creation not found.');
  if(['COMPLETED','CANCELLED'].includes(job.status))return job;
  return job;
}
export async function recordFailure(id:string,error:unknown) {
  const known=error instanceof ServiceError?error:new ServiceError('PROCESSING_FAILED',500,'Creation could not finish.',true);
  await db.creationJob.updateMany({where:{id,status:{notIn:['COMPLETED','CANCELLED']}},data:{status:known.indeterminate?'INDETERMINATE':'FAILED',errorCode:known.code,retryable:known.retryable}});
  return {retryable:known.retryable,code:known.code};
}
export async function transcriptStage(id:string) {
  const job=await pipelineJob(id);if(job.transcript)return;
  const input=parseInput(job.inputJson);
  let text=input.text;
  if(input.sourceAssetId){
    const asset=await db.mediaAsset.findFirst({where:{id:input.sourceAssetId,userId:job.userId,status:'READY'}});
    if(!asset?.format)throw new ServiceError('UPLOAD_INVALID',400,'The source recording is unavailable.');
    const bytes=await readMedia(downloadUrl(asset.publicId,asset.format,'video'),20*1024*1024);
    const claim=await db.creationJob.updateMany({where:{id,transcript:null,stage:{not:'transcription requested'}},data:{status:'QUEUED',stage:'transcription requested'}});
    if(!claim.count){if((await pipelineJob(id)).transcript)return;throw new ServiceError('PROVIDER_RESULT_UNKNOWN',409,'Transcription completion was not confirmed. Review before regenerating.',false,true);}
    try{text=await transcribe(bytes,asset.format);}
    catch(error){if(error instanceof ServiceError&&error.retryable&&!error.indeterminate)await db.creationJob.update({where:{id},data:{stage:'transcription retry'}});throw error;}
  }
  if(!text||text.length>12000)throw new ServiceError('TRANSCRIPT_INVALID',400,'The transcript must contain at most 12000 characters.');
  await db.creationJob.update({where:{id},data:{transcript:text,status:'QUEUED',stage:'transcribed'}});
}
export async function polishStage(id:string) {
  const job=await pipelineJob(id);if(job.planJson)return;
  if(!job.transcript)throw new ServiceError('TRANSCRIPT_MISSING',409,'Transcription must complete first.');
  const claim=await db.creationJob.updateMany({where:{id,planJson:null,stage:{not:'polishing requested'}},data:{status:'QUEUED',stage:'polishing requested'}});
  if(!claim.count){if((await pipelineJob(id)).planJson)return;throw new ServiceError('PROVIDER_RESULT_UNKNOWN',409,'Story polishing completion was not confirmed. Review before regenerating.',false,true);}
  let plan:PolishedPlan;
  try{plan=await polish(job.transcript,parseInput(job.inputJson));}
  catch(error){if(error instanceof ServiceError&&error.retryable&&!error.indeterminate)await db.creationJob.update({where:{id},data:{stage:'polishing retry'}});throw error;}
  await db.creationJob.update({where:{id},data:{planJson:JSON.stringify(plan),status:'SCRIPT_READY',totalScenes:plan.scenes.length}});
}
async function generatedAsset(id:string,slot:string,kind:'image'|'video',format:string,generate:(publicId:string)=>Promise<Buffer|Awaited<ReturnType<typeof storeBytes>>>) {
  const job=await pipelineJob(id);
  const publicId=`oralia/drafts/${job.userId}/${id}/${slot.toLowerCase()}`;
  let asset=await db.mediaAsset.upsert({where:{jobId_slot:{jobId:id,slot}},create:{userId:job.userId,jobId:id,slot,publicId,resourceType:kind,format},update:{}});
  if(asset.status==='READY')return asset;
  if(asset.status==='GENERATING'||asset.status==='INDETERMINATE'){
    try {
      const metadata=assetMetadataSchema.parse(await inspectAsset(publicId,kind));
      return await db.mediaAsset.update({where:{id:asset.id},data:{assetId:metadata.asset_id,bytes:metadata.bytes,format:metadata.format,status:'READY'}});
    } catch {throw new ServiceError('PROVIDER_RESULT_UNKNOWN',409,'A paid operation has an unconfirmed result. Review it before regenerating.',false,true);}
  }
  const claimed=await db.mediaAsset.updateMany({where:{id:asset.id,status:'RESERVED'},data:{status:'GENERATING'}});
  if(!claimed.count)throw new ServiceError('PROVIDER_RESULT_UNKNOWN',409,'Generation is already in progress.',false,true);
  try {
    const output=await generate(publicId);
    const stored=Buffer.isBuffer(output)?await storeBytes(output,publicId,kind,format):output;
    const sampleCount=Buffer.isBuffer(output)&&kind==='video'&&format==='wav'?readWavePcm(output).length/2:null;
    asset=await db.mediaAsset.update({where:{id:asset.id},data:{assetId:stored.result.asset_id,bytes:stored.result.bytes,format:stored.result.format,checksum:stored.checksum,sampleCount,duration:sampleCount===null?null:sampleCount/24000,status:'READY'}});
    return asset;
  } catch(error) {
    const safeRetry=error instanceof ServiceError&&error.retryable&&!error.indeterminate&&error.code!=='MEDIA_UPLOAD_FAILED';
    await db.mediaAsset.update({where:{id:asset.id},data:{status:safeRetry?'RESERVED':error instanceof ServiceError&&(error.indeterminate||error.code==='MEDIA_UPLOAD_FAILED')?'INDETERMINATE':'FAILED'}});
    if(error instanceof ServiceError&&error.code==='MEDIA_UPLOAD_FAILED')throw new ServiceError('PROVIDER_RESULT_UNKNOWN',503,'Generated media storage was not confirmed.',false,true);
    throw error;
  }
}
export async function narrationStage(id:string,index:number) {
  const job=await pipelineJob(id);if(job.status==='COMPLETED')return;const plan=polishedPlanSchema.parse(JSON.parse(job.planJson!));
  await db.creationJob.update({where:{id},data:{status:'PROCESSING_MEDIA',stage:`narration ${index+1}/${plan.scenes.length}`}});
  await generatedAsset(id,`PCM_${index}`,'video','wav',publicId=>streamNarration(plan.scenes[index].narration,publicId));
}
export async function imageStage(id:string,index:number) {
  const job=await pipelineJob(id);if(job.status==='COMPLETED')return;const plan=polishedPlanSchema.parse(JSON.parse(job.planJson!));
  await db.creationJob.update({where:{id},data:{status:'PROCESSING_MEDIA',stage:`image ${index+1}/${plan.scenes.length}`}});
  await generatedAsset(id,`IMAGE_${index}`,'image','png',()=>generateImage(plan.scenes[index].imagePrompt));
  await refreshProgress(id);
}
export async function finalizeStage(id:string) {
  const job=await pipelineJob(id);
  const plan=polishedPlanSchema.parse(JSON.parse(job.planJson!));
  if(await db.storyVersion.findUnique({where:{jobId:id}})){await db.creationJob.update({where:{id},data:{status:'COMPLETED',processedScenes:plan.scenes.length,totalScenes:plan.scenes.length,stage:'ready',errorCode:null,retryable:false}});return;}
  const assets=await db.mediaAsset.findMany({where:{jobId:id,status:'READY'}});
  const segments:Buffer[]=[];
  for(let index=0;index<plan.scenes.length;index++){
    const asset=assets.find(asset=>asset.slot===`PCM_${index}`);
    if(!asset?.format)throw new ServiceError('MEDIA_MISSING',409,'A narration segment is missing.');
    segments.push(readWavePcm(await readMedia(downloadUrl(asset.publicId,asset.format,'video'),20*1024*1024)));
  }
  const assembled=assembleNarration(segments);
  const audio=await generatedAsset(id,'NARRATION','video','wav',async()=>assembled.bytes);
  const scenes=plan.scenes.map((scene,index)=>{
    const image=assets.find(asset=>asset.slot===`IMAGE_${index}`);
    if(!image)throw new ServiceError('MEDIA_MISSING',409,'A scene image is missing.');
    return {assetId:image.id,publicId:image.publicId,...assembled.boundaries[index],proposedStartSeconds:scene.proposedStartSeconds,narration:scene.narration,title:scene.title,prompt:scene.imagePrompt};
  });
  const snapshot=snapshotSchema.parse({input:parseInput(job.inputJson),transcript:job.transcript,plan,audio:{assetId:audio.id,publicId:audio.publicId,duration:assembled.duration},scenes});
  await db.$transaction(async tx=>{
    await tx.storyVersion.upsert({where:{jobId:id},create:{jobId:id,storyId:job.storyId,number:job.version,userId:job.userId,snapshotJson:JSON.stringify(snapshot)},update:{}});
    await tx.creationJob.update({where:{id},data:{status:'COMPLETED',stage:'ready',errorCode:null,retryable:false}});
  });
}

export async function mediaBatch(id:string,start:number) {
  const job=await pipelineJob(id);
  const plan=polishedPlanSchema.parse(JSON.parse(job.planJson!));
  // At most two paid operations in flight. Each scene's audio precedes its image.
  const results=await Promise.allSettled(Array.from({length:Math.min(2,plan.scenes.length-start)},(_,offset)=>(async()=>{
    const index=start+offset;
    await narrationStage(id,index);
    await imageStage(id,index);
    const ready=await db.mediaAsset.findMany({where:{jobId:id,status:'READY'},select:{slot:true}});
    const slots=new Set(ready.map(asset=>asset.slot));
    const completed=plan.scenes.filter((_,i)=>slots.has(`PCM_${i}`)&&slots.has(`IMAGE_${i}`)).length;
    // Monotonic compare/update prevents concurrent completions overwriting newer progress.
    await db.creationJob.updateMany({where:{id,processedScenes:{lt:completed}},data:{processedScenes:completed}});
  })()));
  const failures=results.filter((result):result is PromiseRejectedResult=>result.status==='rejected');
  if(failures.length){const uncertain=failures.find(result=>result.reason instanceof ServiceError&&result.reason.indeterminate);throw (uncertain||failures[0]).reason;}
}
export async function scriptSceneCount(id:string) {
  const job=await pipelineJob(id);const plan=polishedPlanSchema.parse(JSON.parse(job.planJson!));
  await db.creationJob.update({where:{id},data:{totalScenes:plan.scenes.length,status:job.status==='COMPLETED'?'COMPLETED':'SCRIPT_READY'}});
  return plan.scenes.length;
}

export async function refreshProgress(id:string){
  const job=await pipelineJob(id);const plan=polishedPlanSchema.parse(JSON.parse(job.planJson!));
  const assets=await db.mediaAsset.findMany({where:{jobId:id,status:'READY'},select:{slot:true}});const slots=new Set(assets.map(asset=>asset.slot));
  const completed=plan.scenes.filter((_,i)=>slots.has('PCM_'+i)&&slots.has('IMAGE_'+i)).length;
  await db.creationJob.updateMany({where:{id,processedScenes:{lt:completed}},data:{processedScenes:completed}});
}
