import { z } from 'zod';
import { storySchema } from './story';
import { creatorProfileSchema } from './creator';

export const catalogSchema = z.object({ stories: storySchema.array(), creators: creatorProfileSchema.array() });
export const challengeSchema = z.object({ challengeId: z.string(), expiresAt: z.string().datetime() });
export const bookmarksSchema = z.object({ storyIds: z.string().array() });
export const okSchema = z.object({ ok: z.literal(true) });
