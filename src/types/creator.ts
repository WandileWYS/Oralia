import { z } from 'zod';

export const creatorProfileSchema = z.object({
  id: z.string().min(1), username: z.string().regex(/^[a-z0-9_]+$/), name: z.string().min(1),
  bio: z.string(), initials: z.string().min(1).max(3),
  avatarTone: z.enum(['bloom', 'sage', 'gold']), avatarUrl: z.string().optional(),
});
export type CreatorProfile = z.infer<typeof creatorProfileSchema>;

export const creatorEmailSchema = z.string().trim().toLowerCase().email().max(254);
export const creatorSessionSchema = z.object({
  kind: z.literal('verified-email'), email: creatorEmailSchema, displayName: z.string(),
  id: z.string(), username: z.string(), avatarUrl: z.string(),
  expiresAt: z.string().datetime(), preferredVoiceType: z.enum(['ORIGINAL', 'STUDIO_AI']),
});
export type CreatorSession = z.infer<typeof creatorSessionSchema>;
