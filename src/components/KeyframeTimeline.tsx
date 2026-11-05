import { useState } from 'react';
import { getActiveKeyframeIndex } from '../hooks/timeline';
import type { Keyframe } from '../types/story';
import { cn, formatTime } from '../lib/utils';

export function KeyframeTimeline({ frames, duration, currentTime, activeIndex, onSeek }: {
  frames: readonly Keyframe[]; duration: number; currentTime: number; activeIndex: number; onSeek: (time: number) => void;
}) {
  const [previewTime, setPreviewTime] = useState<number | null>(null);
  const percentage = duration ? Math.min(100, currentTime / duration * 100) : 0;
  const previewFrame = previewTime === null ? undefined : frames[getActiveKeyframeIndex(frames, previewTime)];
  return <div className="keyframe-timeline">
    <div className="timeline-scrubber">
      {previewFrame && previewTime !== null && <div className="timeline-preview" role="status" style={{ left: `${Math.max(16, Math.min(84, previewTime / duration * 100))}%` }}><img src={previewFrame.imageUrl} alt={previewFrame.altText} /><span>{formatTime(previewTime)} · Scene {getActiveKeyframeIndex(frames, previewTime) + 1}</span></div>}
      <input aria-label="Story progress" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration)} disabled={!duration} style={{ background: `linear-gradient(to right, var(--accent) ${percentage}%, var(--border) ${percentage}%)` }} onPointerMove={event => { if (!duration) return; const bounds = event.currentTarget.getBoundingClientRect(); setPreviewTime(Math.max(0, Math.min(duration, (event.clientX - bounds.left) / bounds.width * duration))); }} onPointerLeave={() => setPreviewTime(null)} onFocus={() => { if (duration) setPreviewTime(currentTime); }} onBlur={() => setPreviewTime(null)} onChange={event => { const time = Number(event.target.value); onSeek(time); setPreviewTime(time); }} />
    </div>
    <div className="timeline-scenes" aria-label="Keyframe timeline">{frames.map((frame, index) => <button key={frame.id} className={cn('timeline-scene', index === activeIndex && 'active')} disabled={!duration} onClick={() => onSeek(frame.startTime)} aria-label={`Seek to scene ${index + 1} at ${formatTime(frame.startTime)}`} aria-pressed={index === activeIndex}><img src={frame.imageUrl} alt="" /><span>{String(index + 1).padStart(2, '0')}<time>{formatTime(frame.startTime)}</time></span></button>)}</div>
  </div>;
}
