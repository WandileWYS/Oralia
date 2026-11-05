import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getActiveKeyframeIndex } from './timeline.ts';
import { storySchema, timelineSchema } from '../types/story.ts';

const frames = [0, 5, 12].map((startTime, index) => ({
  id: String(index), startTime, endTime: [5, 10, 18][index], imageUrl: '/scene.svg', caption: 'Story', altText: 'Scene',
}));
test('selects exact boundaries and holds images across gaps/end', () => {
  assert.equal(getActiveKeyframeIndex(frames, 0), 0);
  assert.equal(getActiveKeyframeIndex(frames, 4.99), 0);
  assert.equal(getActiveKeyframeIndex(frames, 5), 1);
  assert.equal(getActiveKeyframeIndex(frames, 11), 1);
  assert.equal(getActiveKeyframeIndex(frames, 12), 2);
  assert.equal(getActiveKeyframeIndex(frames, 100), 2);
});
test('recomputes direct backward/forward seeks without an accumulating clock', () => {
  assert.deepEqual([17, 2, 6, 0].map(time => getActiveKeyframeIndex(frames, time)), [2, 0, 1, 0]);
  assert.equal(getActiveKeyframeIndex([], 5), -1);
  assert.equal(getActiveKeyframeIndex(frames, NaN), 0);
});
test('rejects invalid, overlapping, and unsorted cue timelines', () => {
  assert.equal(timelineSchema.safeParse(frames).success, true);
  assert.equal(timelineSchema.safeParse([...frames].reverse()).success, false);
  assert.equal(timelineSchema.safeParse([{ ...frames[0], endTime: 0 }]).success, false);
  assert.equal(timelineSchema.safeParse([{ ...frames[0], startTime: -1 }]).success, false);
  assert.equal(timelineSchema.safeParse([frames[0], { ...frames[1], startTime: 4 }]).success, false);
});
test('story variants match their tier and fit the canonical audio', () => {
  const record = {
    id: 'story', title: 'Story', description: '', creator: 'Demo', category: 'Fiction', isDemo: true,
    audio: { id: 'audio', url: '/demo.wav', mimeType: 'audio/wav', durationSeconds: 18, language: 'en', dialect: null },
    tierVariants: { '5-9': { ageTier: '5-9', stylePreset: 'fairytale', styleLabel: 'Fairytale', contentRating: 'gentle', reviewStatus: 'approved', keyframes: frames } },
  };
  assert.equal(storySchema.safeParse(record).success, true);
  assert.equal(storySchema.safeParse({ ...record, audio: { ...record.audio, durationSeconds: 10 } }).success, false);
  assert.equal(storySchema.safeParse({ ...record, tierVariants: { '5-9': { ...record.tierVariants['5-9'], ageTier: '18+' } } }).success, false);
});
