import { ageTiers, storySchema, type AgeTier, type Story } from '../types/story';
import narration from './demoNarration.json';

export const tierStyles: Record<AgeTier, { label: string; description: string; color: string; theme: string }> = {
  '5-9': { label: 'Little dreamers', description: 'Gentle wonder, warm colours, and soft fairytale illustrations.', color: '#d9a34a', theme: 'Soft fairytale' },
  '10-13': { label: 'Young explorers', description: 'Bold outlines and illustrated adventures for curious minds.', color: '#73835d', theme: 'Adventure illustration' },
  '14-17': { label: 'New perspectives', description: 'Expressive graphic novels with cinematic depth and detail.', color: '#ac745d', theme: 'YA graphic novel' },
  '18+': { label: 'Deeper stories', description: 'Atmospheric concepts, layered themes, and cinematic realism.', color: '#696c86', theme: 'Cinematic concept' },
};
export const demoStory: Story = storySchema.parse({
  id: 'the-listening-tree', title: 'The tree that remembered',
  description: 'A curious child, a golden bird, and a grandmother who knows that every story begins with listening. An original story about the things we pass on.',
  creator: 'Oralia Story Studio', category: 'Original fiction', isDemo: true,
  audio: { id: 'tree-narration', url: '/media/tree-story.wav', mimeType: 'audio/wav', durationSeconds: narration.at(-1)!.endTime, language: 'en', dialect: null },
  tierVariants: Object.fromEntries(ageTiers.map(ageTier => [ageTier, {
    ageTier, stylePreset: ageTier === '5-9' ? 'soft-fairytale' : ageTier === '10-13' ? 'adventure-graphic-novel' : ageTier === '14-17' ? 'cinematic-ya' : 'cinematic-concept',
    styleLabel: tierStyles[ageTier].theme, contentRating: 'gentle-original-fiction', reviewStatus: 'approved',
    keyframes: narration.map((cue, index) => ({ ...cue, id: `${ageTier}-${index}`, imageUrl: `/media/${ageTier === '18+' ? '18-plus' : ageTier}-scene-${index}.svg`, altText: ['A child listens beneath a wide tree in a warm illustrated landscape.', 'A golden bird guides a child toward a winding river.', 'A grandmother meets a child at the river with a woven basket.', 'A child returns beneath the tree to share a story.'][index] })),
  }])),
});
export const mockStories = [demoStory];
export const chapterTitles = ['The listening tree', 'Follow the golden bird', 'Every story is a seed', 'A voice of her own'];
