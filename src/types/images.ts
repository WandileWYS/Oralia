import { z } from 'zod';
import { storyCollectionSchema } from './story.ts';

export const keyframeImageRequestSchema = z.object({
  collection: storyCollectionSchema,
  sceneNumber: z.number().int().min(1).max(4),
  prompt: z.string().trim().min(1).max(2000),
}).strict();
export const keyframeImageResponseSchema = z.object({
  sceneNumber: z.number().int().min(1).max(4),
  imageUrl: z.string().startsWith('/images/fallback/'),
  mimeType: z.literal('image/svg+xml'),
  provenance: z.literal('Oralia illustrative placeholder; not AI generated'),
  fallbackReason: z.enum(['missing-api-key', 'presentation-demo']),
});
export type KeyframeImageRequest = z.infer<typeof keyframeImageRequestSchema>;
