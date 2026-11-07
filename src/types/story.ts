import { z } from 'zod';

export const storyCollections = ['FOLK_AND_FABLE', 'EPIC_AND_CHRONICLE'] as const;
export const storyCollectionSchema = z.enum(storyCollections);
export type StoryCollection = z.infer<typeof storyCollectionSchema>;
export type CollectionFilter = 'ALL' | StoryCollection;
export const collectionLabels: Record<CollectionFilter, string> = { ALL: 'All Collections', FOLK_AND_FABLE: 'Folk & Fable', EPIC_AND_CHRONICLE: 'Epic & Chronicle' };
export const collectionOptions = (['ALL', ...storyCollections] as const).map(value => ({ value, label: collectionLabels[value] }));
export const regionTagSchema = z.enum(['originals', 'west-africa', 'zulu', 'east-africa', 'southern-africa']);
export type RegionTag = z.infer<typeof regionTagSchema>;

export const keyframeSchema = z.object({
  id: z.string().min(1), startTime: z.number().finite().nonnegative(),
  endTime: z.number().finite().positive(), imageUrl: z.string().min(1),
  caption: z.string(), altText: z.string(),
  title: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  imageMimeType: z.enum(['image/svg+xml', 'image/jpeg', 'image/png', 'image/webp']).optional(),
  imageCredit: z.object({ photographer: z.string(), sourceUrl: z.string().url() }).optional(),
}).refine(frame => frame.endTime > frame.startTime, 'End must follow start');
export type Keyframe = z.infer<typeof keyframeSchema>;

export const timelineSchema = z.array(keyframeSchema).superRefine((frames, context) => {
  frames.forEach((frame, index) => {
    if (index > 0 && frame.startTime < frames[index - 1].endTime) {
      context.addIssue({ code: 'custom', path: [index, 'startTime'], message: 'Frames must be sorted and must not overlap' });
    }
  });
});
export const audioTrackSchema = z.object({
  id: z.string(), url: z.string().min(1), mimeType: z.string(),
  durationSeconds: z.number().positive(), language: z.string(), dialect: z.string().nullable(),
});
export type AudioTrack = z.infer<typeof audioTrackSchema>;
export const storyPresentationSchema = z.object({
  stylePreset: z.string(), styleLabel: z.string(), reviewStatus: z.enum(['approved', 'pending']), keyframes: timelineSchema,
});
export type StoryPresentation = z.infer<typeof storyPresentationSchema>;
export const storySchema = z.object({
  id: z.string(), title: z.string(), description: z.string(), creator: z.string(),
  creatorId: z.string().optional(), publishedAt: z.string().datetime().optional(),
  featured: z.boolean().optional(), quote: z.string().optional(),
  regionTag: z.string().optional(), sourceTitle: z.string().optional(), sourceUrl: z.string().url().optional(), culturalNote: z.string().optional(),
  voiceType: z.enum(['ORIGINAL', 'STUDIO_AI']).optional(), originalAudioUrl: z.string().nullable().optional(),
  category: z.string(), audio: audioTrackSchema,
  region: regionTagSchema.optional(),
  collection: storyCollectionSchema, presentation: storyPresentationSchema,
}).superRefine((story, context) => {
  const ids = new Set<string>();
  story.presentation.keyframes.forEach((frame, index) => {
    if (ids.has(frame.id) || frame.endTime > story.audio.durationSeconds) context.addIssue({ code: 'custom', path: ['presentation', 'keyframes', index], message: 'Frames need unique IDs and must fit the audio duration' });
    ids.add(frame.id);
  });
});
export type Story = z.infer<typeof storySchema>;
