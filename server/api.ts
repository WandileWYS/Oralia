import { foundryExportData } from './foundry/service.ts';
import { narrationLanguageSchema } from '../src/types/language.ts';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import { db } from './db.ts';
import { readCatalog } from './catalog.ts';
import { bundledMedia } from './mediaManifest.ts';
import { storyCollectionSchema } from '../src/types/story.ts';
import { creatorEmailSchema } from '../src/types/creator.ts';
import { polishedPlanSchema } from '../src/types/creation.ts';
import { reportDatabaseFailure } from './databaseDiagnostics.ts';
import { auth, sessionData, setSessionCookie } from './auth.ts';
import { appOrigin } from './config.ts';
import { ServiceError } from './errors.ts';
import { completeUpload, createJob, jobData, ownedJob, reserveUpload, retryJob, reviseJob } from './creation.ts';
import { exportData } from './exports.ts';
import { ownedVersion } from './publication.ts';
import { workflowRuntime } from './workflowRuntime.ts';
import {launchExport} from './foundry/runtime.ts';

function send(response:ServerResponse,status:number,value:unknown) {
  response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  response.end(JSON.stringify(value));
}
async function body(request:IncomingMessage):Promise<unknown> {
  const parsed:unknown=(request as IncomingMessage&{body?:unknown}).body;
  let text='';const maxBytes=1024*1024;
  if(parsed!==undefined)text=typeof parsed==='string'?parsed:Buffer.isBuffer(parsed)?parsed.toString():JSON.stringify(parsed);
  else {
    const chunks:Buffer[]=[];let length=0;
    for await(const chunk of request){const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk as Uint8Array);length+=bytes.length;if(length<=maxBytes)chunks.push(bytes);}
    if(length>maxBytes)throw new ServiceError('REQUEST_TOO_LARGE',413,'Request is too large.');
    // Decode once: a transport chunk can end in the middle of a UTF-8 character.
    text=Buffer.concat(chunks).toString('utf8');
  }
  if(Buffer.byteLength(text)>maxBytes)throw new ServiceError('REQUEST_TOO_LARGE',413,'Request is too large.');
  try{return JSON.parse(text);}catch{throw new ServiceError('INVALID_JSON',400,'Send valid JSON.');}
}
function ipAddress(request:IncomingMessage) {
  const forwarded=process.env.VERCEL==='1'?request.headers['x-vercel-forwarded-for']:undefined;
  return typeof forwarded==='string'?forwarded.split(',')[0].trim():request.socket.remoteAddress||'unknown';
}
async function launchCreation(id:string) {
  const claimed=await db.creationJob.updateMany({where:{id,status:'QUEUED',stage:'queued'},data:{stage:'dispatching'}});
  if(!claimed.count)return;
  try {const run=await workflowRuntime.create(id);await db.creationJob.update({where:{id},data:{workflowRunId:run.runId}});}
  catch {await db.creationJob.updateMany({where:{id,status:'QUEUED'},data:{status:'INDETERMINATE',errorCode:'WORKFLOW_START_UNKNOWN',retryable:false}});throw new ServiceError('WORKFLOW_START_UNKNOWN',503,'Creation is saved, but dispatch was not confirmed. Review its status before starting another version.');}
}
export async function handleApi(request:IncomingMessage,response:ServerResponse) {
  try {
    const url=new URL(request.url||'/','http://localhost');const method=request.method;
    if(!url.pathname.startsWith('/api/v1/'))throw new ServiceError('NOT_FOUND',404,'API route not found.');
    const route=url.pathname.slice('/api/v1'.length);
    if(method!=='GET'&&request.headers.origin&&request.headers.origin!==appOrigin())throw new ServiceError('ORIGIN_REJECTED',403,'Use this application’s origin.');
    if(method==='GET'&&route==='/health'){await db.story.count();return send(response,200,{ok:true});}
    if(method==='GET'&&route==='/catalog'){const value=url.searchParams.get('collection');return send(response,200,await readCatalog(value===null?undefined:storyCollectionSchema.parse(value),url.searchParams.has('language')?narrationLanguageSchema.parse(url.searchParams.get('language')):undefined));}
    if(method==='GET'&&(/^\/stories\/[^/]+$/.test(route)||/^\/creators\/[^/]+$/.test(route))){
      const catalog=await readCatalog();const key=decodeURIComponent(route.split('/')[2]);const value=route.startsWith('/stories/')?catalog.stories.find(story=>story.id===key):catalog.creators.find(creator=>creator.username===key);
      if(!value)throw new ServiceError('NOT_FOUND',404,'This story or creator was not found.');return send(response,200,value);
    }
    if(method==='GET'&&route==='/media-status')return send(response,200,{available:bundledMedia.has(url.searchParams.get('url')||'')});
    if(method==='POST'&&route==='/auth/otp/request'){
      const {email}=z.object({email:creatorEmailSchema}).strict().parse(await body(request));return send(response,200,await auth.requestCode(email,ipAddress(request)));
    }
    if(method==='POST'&&route==='/auth/otp/verify'){
      const input=z.object({challengeId:z.string().min(1),pin:z.string().regex(/^\d{6}$/)}).strict().parse(await body(request));
      const result=await auth.verify(input.challengeId,input.pin,ipAddress(request));setSessionCookie(response,result.token,result.expiresAt);return send(response,200,sessionData(result.user,result.expiresAt));
    }
    if(route==='/auth/session'&&method==='GET'){const session=await auth.authorize(request);return send(response,200,sessionData(session.user,session.expiresAt));}
    if(route==='/auth/logout'&&method==='POST'){const session=await auth.authorize(request);await db.session.delete({where:{id:session.id}});setSessionCookie(response,'',new Date(0));return send(response,200,{ok:true});}
    if(route==='/me/voice'&&method==='PATCH'){
      const session=await auth.authorize(request);const {voiceType}=z.object({voiceType:z.enum(['ORIGINAL','STUDIO_AI'])}).parse(await body(request));const user=await db.user.update({where:{id:session.userId},data:{preferredVoiceType:voiceType}});return send(response,200,sessionData(user,session.expiresAt));
    }
    if(route==='/bookmarks'&&method==='GET'){const session=await auth.authorize(request);const records=await db.bookmark.findMany({where:{userId:session.userId}});return send(response,200,{storyIds:records.map(record=>record.storyId)});}
    if(/^\/bookmarks\/[^/]+$/.test(route)&&(method==='PUT'||method==='DELETE')){
      const session=await auth.authorize(request);const storyId=decodeURIComponent(route.split('/')[2]);if(!await db.story.findUnique({where:{id:storyId}}))throw new ServiceError('NOT_FOUND',404,'Story not found.');
      const pair={userId:session.userId,storyId};if(method==='PUT')await db.bookmark.upsert({where:{userId_storyId:pair},create:pair,update:{}});else await db.bookmark.deleteMany({where:pair});return send(response,200,{ok:true});
    }
    if(method==='POST'&&route==='/uploads'){const session=await auth.authorize(request);return send(response,201,await reserveUpload(session.userId));}
    const uploadMatch=route.match(/^\/uploads\/([^/]+)\/complete$/);
    if(method==='POST'&&uploadMatch){const session=await auth.authorize(request);const asset=await completeUpload(session.userId,uploadMatch[1]);return send(response,200,{assetId:asset.id});}
    if(method==='GET'&&route==='/creations'){
      const session=await auth.authorize(request);const jobs=await db.creationJob.findMany({where:{userId:session.userId,NOT:{storyId:{startsWith:'foundry:'}}},orderBy:{createdAt:'desc'},take:20});return send(response,200,{jobs:await Promise.all(jobs.map(job=>jobData(session.userId,job.id)))});
    }
    if(method==='POST'&&route==='/creations'){
      const session=await auth.authorize(request);const {input,requestKey}=z.object({input:z.unknown(),requestKey:z.string().uuid()}).strict().parse(await body(request));const job=await createJob(session.userId,input,requestKey);
      if(job.status==='QUEUED'&&!job.workflowRunId)await launchCreation(job.id);return send(response,202,await jobData(session.userId,job.id));
    }
    const completionMatch=route.match(/^\/creations\/([^/]+)\/notify$/);
    if(method==='POST'&&completionMatch){const session=await auth.authorize(request);await guardCoreJob(session.userId,completionMatch[1]);const job=await ownedJob(session.userId,completionMatch[1]);if(job.status!=='COMPLETED')throw new ServiceError('NOT_READY',409,'Complete generation first.');if(job.notificationStatus==='FAILED')await workflowRuntime.notifyCreation(job.id);return send(response,202,{ok:true});}
    const creationMatch=route.match(/^\/creations\/([^/]+)(?:\/(retry))?$/);
    if(creationMatch){
      const session=await auth.authorize(request);const id=creationMatch[1];await guardCoreJob(session.userId,id);
      if(method==='GET'&&!creationMatch[2])return send(response,200,await jobData(session.userId,id));
      if(method==='POST'&&creationMatch[2]){await retryJob(session.userId,id);await launchCreation(id);return send(response,202,await jobData(session.userId,id));}
      if(method==='PATCH'&&!creationMatch[2]){const {plan,requestKey}=z.object({plan:polishedPlanSchema,requestKey:z.string().uuid()}).strict().parse(await body(request));const next=await reviseJob(session.userId,id,plan,requestKey);if(!next.workflowRunId)await launchCreation(next.id);return send(response,202,await jobData(session.userId,next.id));}
    }
    const publishMatch=route.match(/^\/versions\/([^/]+)\/publish$/);
    if(method==='POST'&&publishMatch){
      const session=await auth.authorize(request);const version=await ownedVersion(publishMatch[1],session.userId);const job=await ownedJob(session.userId,version.jobId);
      if(job.status!=='COMPLETED')throw new ServiceError('NOT_READY',409,'Complete generation before publishing.');z.object({reviewed:z.literal(true)}).strict().parse(await body(request));await db.creationJob.update({where:{id:job.id},data:{stage:'publishing'}});
      try{await workflowRuntime.publish(version.id,session.userId);}catch{await db.creationJob.update({where:{id:job.id},data:{stage:'publish failed',errorCode:'PUBLISH_START_FAILED'}});throw new ServiceError('WORKFLOW_START_FAILED',503,'Publication could not start.');}return send(response,202,{ok:true});
    }
    if(method==='POST'&&route==='/exports'){await auth.authorize(request);throw new ServiceError('FOUNDRY_REQUIRED',410,'Create new asset packages in Studio Foundry.');}
    const exportMatch=route.match(/^\/exports\/([^/]+)(?:\/(notify|download))?$/);
    if(exportMatch){
      const session=await auth.authorize(request);const legacy=await db.storyExport.findFirst({where:{id:exportMatch[1],userId:session.userId,NOT:{versionId:{startsWith:'foundry:'}}}});if(!legacy)throw new ServiceError('NOT_FOUND',404,'Export not found.');const record=await exportData(session.userId,exportMatch[1]);
      if(method==='GET'&&!exportMatch[2])return send(response,200,record);
      if(method==='GET'&&exportMatch[2]==='download'){if(record.status==='READY'&&!record.downloadUrl){const foundry=await foundryExportData(session.userId,record.id);if(foundry.parts.length>1)return send(response,409,{error:'Download individual ZIP parts in Studio Foundry.',code:'MULTIPART_REQUIRED',parts:foundry.parts});}if(!record.downloadUrl)throw new ServiceError('EXPORT_NOT_READY',409,'The archive is not ready.');response.writeHead(302,{Location:record.downloadUrl,'Cache-Control':'no-store'});response.end();return;}
      if(method==='POST'&&exportMatch[2]==='notify'){
        if(record.status!=='READY')throw new ServiceError('EXPORT_NOT_READY',409,'Complete the archive first.');
        await launchExport(record.id,true);
        return send(response,202,{ok:true});
      }
    }
    throw new ServiceError('NOT_FOUND',404,'API route not found.');
  }catch(error){
    if(error instanceof ServiceError)return send(response,error.status,{error:error.message,code:error.code});
    if(error instanceof z.ZodError)return send(response,400,{error:'Check your request values.',code:'VALIDATION_FAILED'});
    reportDatabaseFailure(error,'query');return send(response,503,{error:'The service is unavailable. Please retry shortly.'});
  }
}

async function guardCoreJob(userId:string,id:string){if(await db.creationJob.findFirst({where:{id,userId,storyId:{startsWith:'foundry:'}},select:{id:true}}))throw new ServiceError('NOT_FOUND',404,'Creation not found.');}
