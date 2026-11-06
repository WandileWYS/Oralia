import type { CollectionFilter, Story, StoryPresentation } from '../types/story.ts';
export interface StoryEntry { story: Story; presentation: StoryPresentation }
export function getPlayableStories(stories: readonly Story[], collection: CollectionFilter = 'ALL'): StoryEntry[] {
 return stories.filter(story => (collection === 'ALL' || story.collection === collection) && story.presentation.reviewStatus === 'approved' && story.presentation.keyframes.length > 0).map(story => ({ story, presentation: story.presentation }));
}
export function getCreatorStories(stories: readonly Story[], creatorId: string, collection: CollectionFilter = 'ALL') { return getPlayableStories(stories, collection).filter(({story}) => story.creatorId === creatorId && story.publishedAt); }

export function storyHref(id: string) { return `#stories/${encodeURIComponent(id)}`; }
export function creatorHref(username: string) { return `#creators/${encodeURIComponent(username)}`; }

export type PublicView = { kind: 'story' | 'creator'; key: string };
export function parsePublicView(hash: string): PublicView | null {
  const match = /^#(stories|creators)\/([^/?#]+)$/.exec(hash);
  if (!match) return null;
  try { return { kind: match[1] === 'stories' ? 'story' : 'creator', key: decodeURIComponent(match[2]) }; }
  catch { return null; }
}
