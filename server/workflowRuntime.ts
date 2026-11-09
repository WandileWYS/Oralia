import { start } from 'workflow/api';
import { creationEmailWorkflow, createStoryWorkflow, exportStoryWorkflow, publishStoryWorkflow } from '../workflows/story.ts';
export const workflowRuntime = {
  notifyCreation:(id:string)=>start(creationEmailWorkflow,[id]),
  create: (id:string) => start(createStoryWorkflow,[id]),
  publish: (id:string,userId:string) => start(publishStoryWorkflow,[id,userId]),
  export: (id:string) => start(exportStoryWorkflow,[id]),
};
