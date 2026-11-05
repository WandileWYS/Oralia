import { z } from 'zod';

export const ageTiers = ['5-9', '10-13', '14-17', '18+'] as const;
export const ageTierSchema = z.enum(ageTiers);
export type AgeTier = z.infer<typeof ageTierSchema>;

export const keyframeSchema = z.object({
  id: z.string().min(1), startTime: z.number().finite().nonnegative(),
  endTime: z.number().finite().positive(), imageUrl: z.string().min(1),
  caption: z.string(), altText: z.string(),
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
export const storyVariantSchema = z.object({
  ageTier: ageTierSchema, stylePreset: z.string(), styleLabel: z.string(),
  contentRating: z.string(), reviewStatus: z.enum(['approved', 'pending']), keyframes: timelineSchema,
});
export type StoryVariant = z.infer<typeof storyVariantSchema>;
export const storySchema = z.object({
  id: z.string(), title: z.string(), description: z.string(), creator: z.string(),
  category: z.string(), audio: audioTrackSchema,
  tierVariants: z.partialRecord(ageTierSchema, storyVariantSchema),
  isDemo: z.boolean(),
}).superRefine((story, context) => {
  Object.entries(story.tierVariants).forEach(([tier, variant]) => {
    if (!variant) return;
    if (variant.ageTier !== tier) context.addIssue({ code: 'custom', path: ['tierVariants', tier], message: 'Variant age must match its tier key' });
    const ids = new Set<string>();
    variant.keyframes.forEach((frame, index) => {
      if (ids.has(frame.id) || frame.endTime > story.audio.durationSeconds) {
        context.addIssue({ code: 'custom', path: ['tierVariants', tier, 'keyframes', index], message: 'Frames need unique IDs and must fit the audio duration' });
      }
      ids.add(frame.id);
    });
  });
});
export type Story = z.infer<typeof storySchema>;

export interface StoryboardFrame extends Keyframe {
  prompt: string;
}

export interface CreatorAssetBundle {
  id: string;
  projectName: string;
  ageTier: AgeTier;
  pitch: string;
  frames: StoryboardFrame[];
  status: 'preview' | 'exported';
  notificationStatus: 'not-requested' | 'simulated';
}
