import type { CollectionFilter, RegionTag, Story } from '../types/story.ts';
import { getPlayableStories } from './catalog.ts';
export type RegionFilter = 'all' | RegionTag;
export function filterEducationStories(stories: readonly Story[], collection: CollectionFilter, region: RegionFilter) { return getPlayableStories(stories, collection).filter(({story}) => region === 'all' || story.region === region); }
