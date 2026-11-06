import type { StoryCollection } from '../types/story.ts';
export const collectionStyles: Record<StoryCollection, { label: string; description: string; theme: string }> = {
 FOLK_AND_FABLE: { label: 'Folk & Fable', description: 'Wit, wonder, and reflection in animal tales and oral fables.', theme: 'Warm illustrated fable' },
 EPIC_AND_CHRONICLE: { label: 'Epic & Chronicle', description: 'Origin narratives, journeys, memory, and consequence.', theme: 'Cinematic chronicle' },
};
