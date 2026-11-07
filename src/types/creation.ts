import { z } from 'zod';
import { regionTagSchema, storyCollectionSchema } from './story.ts';

export const inputSchema = z.object({
  title: z.string().trim().min(1).max(100), collection: storyCollectionSchema, region: regionTagSchema,
  text: z.string().trim().max(5000).optional(), sourceAssetId: z.string().optional(),
  provenance: z.string().trim().min(1).max(1000), language: z.string().min(2).max(30).default('en'),
}).strict().refine(value => Boolean(value.text) !== Boolean(value.sourceAssetId), 'Provide either text or a recording.');
export const scenePlanSchema = z.object({
  title: z.string().min(1).max(100), narration: z.string().trim().min(1).max(2000),
  imagePrompt: z.string().trim().min(1).max(2000), proposedStartSeconds: z.number().finite().nonnegative(),
}).strict();
export const polishedPlanSchema = z.object({
  polishedText: z.string().trim().min(1).max(5000), scenes: z.array(scenePlanSchema).length(4),
}).strict().superRefine((value, context) => {
  if (value.scenes.map(scene=>scene.narration).join('\n\n').replace(/\s+/g,' ').trim() !== value.polishedText.replace(/\s+/g,' ').trim()) context.addIssue({code:'custom',message:'Scene narration must equal the polished story.'});
  value.scenes.forEach((scene,i)=>{if(i===0?scene.proposedStartSeconds!==0:scene.proposedStartSeconds<=value.scenes[i-1].proposedStartSeconds)context.addIssue({code:'custom',message:'Proposed timestamps must start at zero and increase.'});});
});
export const jobSchema = z.object({ id:z.string(),storyId:z.string(),version:z.number(),status:z.string(),stage:z.string(),errorCode:z.string().nullable(),retryable:z.boolean(),transcript:z.string().nullable(),plan:polishedPlanSchema.nullable(),versionId:z.string().nullable(),preview:z.array(z.object({sceneNumber:z.number(),imageUrl:z.string(),narration:z.string()})).default([]),audioUrl:z.string().nullable().default(null) });
export const exportSchema = z.object({id:z.string(),status:z.string(),notificationStatus:z.string(),errorCode:z.string().nullable(),downloadUrl:z.string().nullable()});
export type CreationInput = z.infer<typeof inputSchema>;
export type PolishedPlan = z.infer<typeof polishedPlanSchema>;
export type CreationJob = z.infer<typeof jobSchema>;
export const snapshotSchema=z.object({input:inputSchema,transcript:z.string(),plan:polishedPlanSchema,audio:z.object({assetId:z.string(),publicId:z.string(),duration:z.number().positive()}),scenes:z.array(z.object({assetId:z.string(),publicId:z.string(),startTime:z.number().nonnegative(),endTime:z.number().positive(),proposedStartSeconds:z.number().nonnegative(),narration:z.string(),title:z.string(),prompt:z.string()})).length(4)});
