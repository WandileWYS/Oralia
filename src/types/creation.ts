import { z } from 'zod';
import { regionTagSchema, storyCollectionSchema } from './story.ts';

export const inputSchema = z.object({
  title: z.string().trim().max(100).default(''), collection: storyCollectionSchema, region: regionTagSchema,
  text: z.string().trim().max(12000).optional(), sourceAssetId: z.string().optional(),
  provenance: z.string().trim().min(1).max(1000), language: z.string().min(2).max(30).default('en'),
}).strict().refine(value => Boolean(value.text) !== Boolean(value.sourceAssetId), 'Provide either text or a recording.');
export const scenePlanSchema = z.object({
  title: z.string().min(1).max(100), narration: z.string().trim().min(1).max(2000),
  imagePrompt: z.string().trim().min(1).max(2000), proposedStartSeconds: z.number().finite().nonnegative(), proposedEndSeconds:z.number().finite().positive().optional(),
}).strict();
export const polishedPlanSchema = z.object({
  polishedTitle: z.string().trim().min(1).max(100).optional(), language: z.string().min(2).max(30).optional(),
  polishedText: z.string().trim().min(1).max(12000), scenes: z.array(scenePlanSchema).min(1).max(64),
}).strict().superRefine((value, context) => {
  if (value.scenes.map(scene=>scene.narration).join('\n\n').replace(/\s+/g,' ').trim() !== value.polishedText.replace(/\s+/g,' ').trim()) context.addIssue({code:'custom',message:'Scene narration must equal the polished story.'});
  value.scenes.forEach((scene,i)=>{if(scene.proposedEndSeconds!==undefined&&(scene.proposedEndSeconds<=scene.proposedStartSeconds||(i<value.scenes.length-1&&Math.abs(scene.proposedEndSeconds-value.scenes[i+1].proposedStartSeconds)>0.001)))context.addIssue({code:'custom',message:'Proposed scene boundaries must be continuous.'});if(i===0?scene.proposedStartSeconds!==0:scene.proposedStartSeconds<=value.scenes[i-1].proposedStartSeconds)context.addIssue({code:'custom',message:'Proposed timestamps must start at zero and increase.'});});
});
export const jobSchema = z.object({ id:z.string(),storyId:z.string(),version:z.number(),status:z.string(),stage:z.string(),totalScenes:z.number().int().nonnegative().default(0),processedScenes:z.number().int().nonnegative().default(0),completionPercentage:z.number().min(0).max(100).default(0),notificationStatus:z.string().default("PENDING"),errorCode:z.string().nullable(),retryable:z.boolean(),transcript:z.string().nullable(),plan:polishedPlanSchema.nullable(),versionId:z.string().nullable(),boundaries:z.array(z.object({startTime:z.number(),endTime:z.number(),startTimestamp:z.string(),endTimestamp:z.string()})).default([]),preview:z.array(z.object({sceneNumber:z.number(),imageUrl:z.string(),narration:z.string()})).default([]),audioUrl:z.string().nullable().default(null) });
export const exportSchema = z.object({id:z.string(),status:z.string(),notificationStatus:z.string(),errorCode:z.string().nullable(),downloadUrl:z.string().nullable()});
export type CreationInput = z.infer<typeof inputSchema>;
export type PolishedPlan = z.infer<typeof polishedPlanSchema>;
export type CreationJob = z.infer<typeof jobSchema>;
export const snapshotSchema=z.object({input:inputSchema,transcript:z.string(),plan:polishedPlanSchema,audio:z.object({assetId:z.string(),publicId:z.string(),duration:z.number().positive()}),scenes:z.array(z.object({assetId:z.string(),publicId:z.string(),startTime:z.number().nonnegative(),endTime:z.number().positive(),proposedStartSeconds:z.number().nonnegative(),narration:z.string(),title:z.string(),prompt:z.string()})).min(1).max(64)});
