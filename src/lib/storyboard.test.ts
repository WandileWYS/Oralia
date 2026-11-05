import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeFrameDuration, moveFrame } from './storyboard.ts';

const frames = [0, 5, 12].map((startTime, index) => ({
  id: String(index), startTime, endTime: [5, 12, 18][index],
  imageUrl: '/demo.svg', caption: 'Original caption', altText: 'Scene', prompt: `Prompt ${index}`,
}));
test('reordering preserves assets and durations and produces a continuous timeline', () => {
  const reordered = moveFrame(frames, '1', -1);
  assert.deepEqual(reordered.map(frame => frame.id), ['1', '0', '2']);
  assert.deepEqual(reordered.map(frame => [frame.startTime, frame.endTime]), [[0, 7], [7, 12], [12, 18]]);
  assert.equal(reordered[0].prompt, 'Prompt 1');
  assert.equal(frames[1].startTime, 5);
  assert.deepEqual(moveFrame(frames, '0', -1), frames);
});
test('duration edits propagate and invalid inputs cannot enter the export timeline', () => {
  const updated = changeFrameDuration(frames, '0', 8.5);
  assert.deepEqual(updated.map(frame => [frame.startTime, frame.endTime]), [[0, 8.5], [8.5, 15.5], [15.5, 21.5]]);
  assert.throws(() => changeFrameDuration(frames, '0', NaN), RangeError);
  assert.throws(() => changeFrameDuration(frames, '0', 0), RangeError);
  assert.throws(() => changeFrameDuration(frames, '0', 61), RangeError);
});
