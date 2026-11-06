import type { AgeTier } from '../types/story.ts';

export const tierStyles: Record<AgeTier, { label: string; description: string; color: string; theme: string }> = {
  '5-9': { label: 'Little dreamers', description: 'Gentle wonder and soft fairytale illustration.', color: '#d9a34a', theme: 'Soft fairytale' },
  '10-13': { label: 'Young explorers', description: 'Bold outlines and illustrated adventures.', color: '#73835d', theme: 'Adventure illustration' },
  '14-17': { label: 'New perspectives', description: 'Graphic narratives with context and depth.', color: '#ac745d', theme: 'YA graphic novel' },
  '18+': { label: 'Deeper stories', description: 'Layered themes and historical perspectives.', color: '#696c86', theme: 'Cinematic concept' },
};
