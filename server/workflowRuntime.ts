import { start } from 'workflow/api';
import { createStoryWorkflow, exportStoryWorkflow, publishStoryWorkflow } from '../workflows/story.ts';
export const workflowRuntime = {
  create: (id:string) => start(createStoryWorkflow,[id]),
  publish: (id:string,userId:string) => start(publishStoryWorkflow,[id,userId]),
  export: (id:string) => start(exportStoryWorkflow,[id]),
};
