import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageTiers, type Story, type StoryVariant } from '../types/story.ts';
import { filterEducationStories } from './education.ts';

const variant: StoryVariant = {
  ageTier: '5-9', reviewStatus: 'approved', contentRating: 'gentle', stylePreset: 'fairytale', styleLabel: 'Fairytale',
  keyframes: [{ id: 'scene', startTime: 0, endTime: 5, imageUrl: '/scene.svg', caption: 'Original words.', altText: 'A tree.' }],
};
const story: Story = {
  id: 'original', title: 'An original', description: '', creator: 'Studio', category: 'Fiction',
  educationCollection: 'originals',
  audio: { id: 'audio', url: '/audio.wav', mimeType: 'audio/wav', durationSeconds: 5, language: 'en', dialect: null },
  tierVariants: Object.fromEntries(ageTiers.map(ageTier => [ageTier, { ...variant, ageTier }])),
};

test('selects the exact approved variant for every canonical tier without rewriting source content', () => {
  for (const ageTier of ageTiers) {
    const [entry] = filterEducationStories([story], ageTier, 'all');
    assert.equal(entry.story, story);
    assert.equal(entry.variant, story.tierVariants[ageTier]);
    assert.equal(entry.variant.keyframes[0].caption, 'Original words.');
  }
});

test('never substitutes missing, pending, mistagged, or empty age variants', () => {
  const invalidStories: Story[] = [
    { ...story, tierVariants: { '18+': { ...variant, ageTier: '18+' } } },
    { ...story, tierVariants: { '5-9': { ...variant, reviewStatus: 'pending' } } },
    { ...story, tierVariants: { '5-9': { ...variant, ageTier: '18+' } } },
    { ...story, tierVariants: { '5-9': { ...variant, keyframes: [] } } },
  ];
  assert.deepEqual(filterEducationStories(invalidStories, '5-9', 'all'), []);
});

test('intersects editorial collection membership with age approval; titles and demo flags confer no provenance', () => {
  const unassigned = { ...story, id: 'unassigned', title: 'Zulu Mythology', educationCollection: undefined };
  const west: Story = { ...story, id: 'west', educationCollection: 'west-africa' };
  const zulu: Story = { ...story, id: 'zulu', educationCollection: 'zulu', tierVariants: { '18+': { ...variant, ageTier: '18+' } } };
  const east: Story = { ...story, id: 'east', educationCollection: 'east-africa' };
  const stories = [story, unassigned, west, zulu, east];
  assert.deepEqual(filterEducationStories(stories, '5-9', 'originals').map(entry => entry.story.id), ['original']);
  assert.deepEqual(filterEducationStories(stories, '5-9', 'west-africa').map(entry => entry.story.id), ['west']);
  assert.deepEqual(filterEducationStories(stories, '5-9', 'zulu'), []);
  assert.deepEqual(filterEducationStories(stories, '18+', 'zulu').map(entry => entry.story.id), ['zulu']);
  assert.deepEqual(filterEducationStories(stories, '5-9', 'east-africa').map(entry => entry.story.id), ['east']);
  assert.equal(filterEducationStories(stories, '5-9', 'all').length, 4);
  assert.deepEqual(filterEducationStories([], '5-9', 'all'), []);
});
