import { FatalError, RetryableError } from 'workflow';
import { publishVersion } from '../server/publication.ts';
import { packageVersion, notifyExport } from '../server/exports.ts';

export async function createStoryWorkflow(jobId:string) {
  'use workflow';
  await creationStep(jobId,'transcript');
  await creationStep(jobId,'polish');
  const count=await sceneCountStep(jobId);
  for(let start=0;start<count;start+=2){
    const indices=Array.from({length:Math.min(2,count-start)},(_,offset)=>start+offset);
    await Promise.all(indices.map(index=>creationStep(jobId,'narration',index)));
    await Promise.all(indices.map(index=>creationStep(jobId,'image',index)));
  }
  await creationStep(jobId,'finalize');
  await completionEmailStep(jobId);
}
async function creationStep(id:string,stage:'transcript'|'polish'|'narration'|'image'|'finalize',index=0) {
  'use step';
  const pipeline=await import('../server/pipeline.ts');
  try {
    if(stage==='transcript')await pipeline.transcriptStage(id);
    if(stage==='polish')await pipeline.polishStage(id);
    if(stage==='narration')await pipeline.narrationStage(id,index);
    if(stage==='image')await pipeline.imageStage(id,index);
    if(stage==='finalize')await pipeline.finalizeStage(id);
  } catch(error) {
    const failure=await pipeline.recordFailure(id,error);
    if(failure.retryable)throw new RetryableError('Provider temporarily unavailable.',{retryAfter:'5s'});
    throw new FatalError('Creation stopped: '+failure.code);
  }
}
creationStep.maxRetries=2;

export async function publishStoryWorkflow(versionId:string,userId:string) {
  'use workflow';
  await publicationStep(versionId,userId);
}
async function publicationStep(versionId:string,userId:string) {
  'use step';
  try{await publishVersion(versionId,userId);}catch{
    const {db}=await import('../server/db.ts');
    const version=await db.storyVersion.findFirst({where:{id:versionId,userId}});
    if(version)await db.creationJob.update({where:{id:version.jobId},data:{stage:'publication failed',errorCode:'PUBLICATION_FAILED'}});
    throw new Error('Publication could not finish.');
  }
}
publicationStep.maxRetries=2;

export async function exportStoryWorkflow(exportId:string) {
  'use workflow';
  await packageStep(exportId);
  await notificationStep(exportId);
}
async function packageStep(exportId:string) {
  'use step';
  await packageVersion(exportId);
}
packageStep.maxRetries=2;
async function notificationStep(exportId:string) {
  'use step';
  await notifyExport(exportId);
}
notificationStep.maxRetries=2;

async function sceneCountStep(id:string){
  'use step';
  const {scriptSceneCount}=await import('../server/pipeline.ts');
  return scriptSceneCount(id);
}
export async function creationEmailWorkflow(id:string){
  'use workflow';
  await completionEmailStep(id);
}
async function completionEmailStep(id:string){
  'use step';
  const {notifyCreation}=await import('../server/creationNotification.ts');
  await notifyCreation(id);
}
completionEmailStep.maxRetries=2;
