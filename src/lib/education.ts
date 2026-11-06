import type { AgeTier, EducationCollection, Story } from '../types/story.ts';
import { getPlayableStories, type StoryEntry } from './catalog.ts';

export type EducationFilter = 'all' | EducationCollection;
export type EducationEntry = StoryEntry;

/** Collection membership is explicit editorial metadata, never inferred from a title or image. */
export function filterEducationStories(stories: readonly Story[], ageTier: AgeTier, collection: EducationFilter): EducationEntry[] {
  return getPlayableStories(stories, ageTier).filter(({ story }) => collection === 'all' || story.educationCollection === collection);
}
