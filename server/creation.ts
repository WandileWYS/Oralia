import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db } from './db.ts';
import { inputSchema, polishedPlanSchema, type CreationInput, type PolishedPlan } from '../src/types/creation.ts';
import { ServiceError } from './errors.ts';
import { requireCreationConfiguration } from './config.ts';
import { downloadUrl, inspectAsset, removeAsset, uploadParameters } from './providers/storage.ts';
import type { Prisma } from './generated/prisma/client.ts';

async function budget(tx:Prisma.TransactionClient,userId:string){
  const active=await tx.creationJob.count({where:{userId,status:{in:['QUEUED','SCRIPT_READY','PROCESSING_MEDIA']}}});
  const today=await tx.creationJob.count({where:{userId,createdAt:{gte:new Date(Date.now()-86400000)}}});
  if(active>=2||today>=10)throw new ServiceError('GENERATION_LIMIT',429,'Your creation limit has been reached. Try again later.');
}

export const assetMetadataSchema=z.object({asset_id:z.string(),public_id:z.string(),resource_type:z.string(),type:z.string(),format:z.string(),bytes:z.number().int().positive(),duration:z.number().positive().optional()});
export async function reserveUpload(userId: string) {
  if(await db.mediaAsset.count({where:{userId,slot:'SOURCE',createdAt:{gte:new Date(Date.now()-86400000)}}})>=30)throw new ServiceError('UPLOAD_LIMIT',429,'Your daily recording upload limit has been reached.');
  const publicId=`oralia/source/${userId}/${randomUUID()}`;
  const signed=uploadParameters(publicId);
  const asset=await db.mediaAsset.create({data:{userId,slot:'SOURCE',publicId,resourceType:'video'}});
  return {assetId:asset.id,...signed};
}
export async function completeUpload(userId: string,id:string) {
  const asset=await db.mediaAsset.findFirst({where:{id,userId,slot:'SOURCE'}});
  if(!asset)throw new ServiceError('NOT_FOUND',404,'Upload not found.');
  const metadata=assetMetadataSchema.parse(await inspectAsset(asset.publicId,'video'));
  if(metadata.public_id!==asset.publicId||metadata.type!=='authenticated'||metadata.resource_type!=='video'||metadata.bytes>20*1024*1024||!metadata.duration||metadata.duration>300||!['mp3','wav','m4a','webm','ogg','mp4','flac'].includes(metadata.format)) {
    await removeAsset(asset.publicId);
    throw new ServiceError('UPLOAD_INVALID',400,'Choose supported audio up to five minutes and 20 MB.');
  }
  return db.mediaAsset.update({where:{id},data:{assetId:metadata.asset_id,bytes:metadata.bytes,duration:metadata.duration,format:metadata.format,status:'READY'}});
}
export async function createJob(userId:string,raw:unknown,requestKey:string) {
  const input=inputSchema.parse(raw);
  const existing=await db.creationJob.findUnique({where:{userId_requestKey:{userId,requestKey}}});
  if(existing){if(existing.inputJson!==JSON.stringify(input))throw new ServiceError('IDEMPOTENCY_CONFLICT',409,'This submission key belongs to another story input.');return existing;}
  requireCreationConfiguration();
  if(input.sourceAssetId&&!await db.mediaAsset.findFirst({where:{id:input.sourceAssetId,userId,status:'READY',slot:'SOURCE'}}))throw new ServiceError('UPLOAD_INVALID',400,'Complete your recording upload first.');
  return db.$transaction(async tx=>{await budget(tx,userId);return tx.creationJob.create({data:{userId,storyId:randomUUID(),requestKey,inputJson:JSON.stringify(input)}});});
}
export async function ownedJob(userId:string,id:string) {
  const job=await db.creationJob.findFirst({where:{id,userId}});
  if(!job)throw new ServiceError('NOT_FOUND',404,'Creation not found.');
  return job;
}
export async function jobData(userId:string,id:string) {
  const job=await ownedJob(userId,id);
  const version=await db.storyVersion.findUnique({where:{jobId:job.id}});
  const assets=await db.mediaAsset.findMany({where:{jobId:job.id,status:'READY'}});
  const plan=job.planJson?polishedPlanSchema.parse(JSON.parse(job.planJson)):null;
  const audio=assets.find(asset=>asset.slot==='NARRATION');
  return {id:job.id,storyId:job.storyId,version:job.version,status:job.status,stage:job.stage,totalScenes:job.totalScenes,processedScenes:job.processedScenes,completionPercentage:job.status==='COMPLETED'?100:job.totalScenes?Math.floor(job.processedScenes/job.totalScenes*95):0,notificationStatus:job.notificationStatus,errorCode:job.errorCode,retryable:job.retryable,transcript:job.transcript,plan,versionId:version?.id??null,audioUrl:audio?downloadUrl(audio.publicId,audio.format!,'video'):null,boundaries:version?JSON.parse(version.snapshotJson).scenes.map((scene:{startTime:number;endTime:number})=>({...scene,startTimestamp:timestamp(scene.startTime),endTimestamp:timestamp(scene.endTime)})):[],preview:plan?plan.scenes.flatMap((scene,i)=>{const image=assets.find(asset=>asset.slot===`IMAGE_${i}`);return image?[{sceneNumber:i+1,imageUrl:downloadUrl(image.publicId,image.format!,'image'),narration:scene.narration}]:[]}):[]};
}
export async function reviseJob(userId:string,id:string,plan:PolishedPlan,requestKey:string) {
  const previous=await ownedJob(userId,id);
  if(!['COMPLETED','FAILED','INDETERMINATE'].includes(previous.status))throw new ServiceError('JOB_BUSY',409,'Wait for the current creation to finish.');
  requireCreationConfiguration();
  const parsed=polishedPlanSchema.parse(plan);
  return db.$transaction(async tx=>{
    const exists=await tx.creationJob.findUnique({where:{userId_requestKey:{userId,requestKey}}});if(exists)return exists;
    await budget(tx,userId);
    const latest=await tx.creationJob.findFirst({where:{storyId:previous.storyId,userId},orderBy:{version:'desc'}});
    return tx.creationJob.create({data:{userId,storyId:previous.storyId,version:(latest?.version??0)+1,requestKey,inputJson:previous.inputJson,transcript:previous.transcript,planJson:JSON.stringify(parsed),totalScenes:parsed.scenes.length}});
  });
}
export async function retryJob(userId:string,id:string) {
  const previous=await ownedJob(userId,id);
  if(previous.status!=='FAILED'||!previous.retryable)throw new ServiceError('RETRY_NOT_ALLOWED',409,'This creation requires review before another generation.');
  const updated=await db.creationJob.updateMany({where:{id,userId,status:'FAILED',retryable:true},data:{status:'QUEUED',stage:'queued',workflowRunId:null,errorCode:null,retryable:false}});
  if(!updated.count)throw new ServiceError('JOB_BUSY',409,'The creation has already been restarted.');
  return previous;
}
export function parseInput(value:string):CreationInput{return inputSchema.parse(JSON.parse(value));}

function timestamp(seconds:number){const minutes=Math.floor(seconds/60);return String(minutes).padStart(2,'0')+':'+(seconds-minutes*60).toFixed(3).padStart(6,'0');}
