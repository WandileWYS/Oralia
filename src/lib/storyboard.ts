import type { StoryboardFrame } from '../types/story.ts';

const round = (seconds: number) => Math.round(seconds * 1000) / 1000;

/** Studio timing describes the edited storyboard, independently of narration. */
export function retimeFrames(frames: readonly StoryboardFrame[]): StoryboardFrame[] {
  let cursor = 0;
  return frames.map(frame => {
    const duration = round(frame.endTime - frame.startTime);
    if (!Number.isFinite(duration) || duration < 1 || duration > 60) {
      throw new RangeError('Each frame duration must be between 1 and 60 seconds.');
    }
    const updated = { ...frame, startTime: cursor, endTime: round(cursor + duration) };
    cursor = updated.endTime;
    return updated;
  });
}

export function moveFrame(frames: readonly StoryboardFrame[], id: string, offset: -1 | 1) {
  const from = frames.findIndex(frame => frame.id === id);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= frames.length) return [...frames];
  const ordered = [...frames];
  [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
  return retimeFrames(ordered);
}

export function changeFrameDuration(frames: readonly StoryboardFrame[], id: string, duration: number) {
  if (!Number.isFinite(duration) || duration < 1 || duration > 60) throw new RangeError('Use a duration from 1 to 60 seconds.');
  return retimeFrames(frames.map(frame => frame.id === id ? { ...frame, endTime: frame.startTime + duration } : frame));
}
