import type { AgeTier, Story, StoryVariant } from '../types/story.ts';

export interface StoryEntry { story: Story; variant: StoryVariant }

export function getPlayableStories(stories: readonly Story[], ageTier: AgeTier): StoryEntry[] {
  return stories.flatMap(story => {
    const variant = story.tierVariants[ageTier];
    if (!variant || variant.ageTier !== ageTier || variant.reviewStatus !== 'approved' || !variant.keyframes.length) return [];
    return [{ story, variant }];
  });
}

export function getCreatorStories(stories: readonly Story[], creatorId: string, ageTier: AgeTier): StoryEntry[] {
  return getPlayableStories(stories, ageTier).filter(({ story }) => story.creatorId === creatorId && story.publishedAt);
}

export function storyHref(id: string) { return `#stories/${encodeURIComponent(id)}`; }
export function creatorHref(username: string) { return `#creators/${encodeURIComponent(username)}`; }

export type PublicView = { kind: 'story' | 'creator'; key: string };
export function parsePublicView(hash: string): PublicView | null {
  const match = /^#(stories|creators)\/([^/?#]+)$/.exec(hash);
  if (!match) return null;
  try { return { kind: match[1] === 'stories' ? 'story' : 'creator', key: decodeURIComponent(match[2]) }; }
  catch { return null; }
}
