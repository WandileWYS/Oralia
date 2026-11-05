import type { Keyframe } from '../types/story.ts';

/** Gaps hold the preceding frame; before the first cue the first image is a poster. */
export function getActiveKeyframeIndex(frames: readonly Keyframe[], time: number): number {
  if (frames.length === 0) return -1;
  const position = Number.isFinite(time) ? Math.max(0, time) : 0;
  let low = 0;
  let high = frames.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    if (frames[middle].startTime <= position) low = middle + 1;
    else high = middle - 1;
  }
  return Math.max(0, high);
}
