import {FatalError,RetryableError} from 'workflow';
export async function foundryWorkflow(id:string){
 'use workflow';
 const count=await foundryPlanStep(id);
 for(let start=0;start<count;start+=2){const indices=Array.from({length:Math.min(2,count-start)},(_,i)=>start+i);await Promise.all(indices.map(i=>foundryMediaStep(id,i,'audio')));await Promise.all(indices.map(i=>foundryMediaStep(id,i,'image')));}
 const exportId=await foundryTimelineStep(id);await packageSteps(exportId);await foundryEmailStep(exportId);
}
async function foundryPlanStep(id:string){'use step';const p=await import('../server/foundry/pipeline.ts');try{return await p.planJob(id);}catch(error){await stop(id,error);throw error;}}
async function foundryMediaStep(id:string,index:number,kind:'image'|'audio'){'use step';const p=await import('../server/foundry/pipeline.ts');try{await p.mediaJob(id,index,kind);}catch(error){await stop(id,error);}}
async function foundryTimelineStep(id:string){'use step';const p=await import('../server/foundry/pipeline.ts');try{return await p.timelineJob(id);}catch(error){await stop(id,error);throw error;}}
async function stop(id:string,error:unknown){const {failJob}=await import('../server/foundry/pipeline.ts');const failure=await failJob(id,error);if(failure.retryable)throw new RetryableError('Foundry operation temporarily unavailable.',{retryAfter:'10s'});throw new FatalError('Foundry stopped: '+failure.code);}
foundryPlanStep.maxRetries=2;foundryMediaStep.maxRetries=2;foundryTimelineStep.maxRetries=2;
export async function foundryExportWorkflow(id:string){'use workflow';await packageSteps(id);await foundryEmailStep(id);}
export async function foundryEmailWorkflow(id:string){'use workflow';await foundryEmailStep(id);}
async function packageSteps(id:string){const parts=await foundryPrepareStep(id);for(const number of parts)await foundryPartStep(id,number);await foundryFinishStep(id);}
async function foundryPrepareStep(id:string){'use step';const {prepareFoundryExport}=await import('../server/foundry/archive.ts');return prepareFoundryExport(id);}
async function foundryPartStep(id:string,part:number){'use step';const {packageFoundryPart}=await import('../server/foundry/archive.ts');await packageFoundryPart(id,part);}
async function foundryFinishStep(id:string){'use step';const {finishFoundryExport}=await import('../server/foundry/archive.ts');await finishFoundryExport(id);}
async function foundryEmailStep(id:string){'use step';const {notifyFoundryExport}=await import('../server/foundry/archive.ts');await notifyFoundryExport(id);}
foundryPrepareStep.maxRetries=2;foundryPartStep.maxRetries=2;foundryFinishStep.maxRetries=2;foundryEmailStep.maxRetries=2;
