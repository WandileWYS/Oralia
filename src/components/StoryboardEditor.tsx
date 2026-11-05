import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Clock3, GripVertical } from 'lucide-react';
import type { StoryboardFrame } from '../types/story';
import { formatTime } from '../lib/utils';

interface FrameProps { frame: StoryboardFrame; index: number; count: number; onMove: (offset: -1 | 1) => void; onDuration: (seconds: number) => void; onPrompt: (prompt: string) => void }
function FrameEditor({ frame, index, count, onMove, onDuration, onPrompt }: FrameProps) {
  const duration = Math.round((frame.endTime - frame.startTime) * 1000) / 1000;
  const [draft, setDraft] = useState(String(duration));
  const [error, setError] = useState('');
  useEffect(() => setDraft(String(duration)), [duration, frame]);
  return <article className="editable-frame" aria-label={`Storyboard frame ${index + 1}`}><div className="frame-art"><img src={frame.imageUrl} alt={frame.altText} /><span className="frame-number"><GripVertical size={13} />SCENE {String(index + 1).padStart(2, '0')}</span><div className="reorder-controls"><button aria-label={`Move frame ${index + 1} earlier`} disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp size={15} /></button><button aria-label={`Move frame ${index + 1} later`} disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown size={15} /></button></div></div><div className="frame-fields"><div className="frame-duration"><label htmlFor={`duration-${frame.id}`}><Clock3 size={13} />Duration (seconds)</label><input id={`duration-${frame.id}`} aria-label={`Frame ${index + 1} duration`} type="number" min="1" max="60" step="any" value={draft} onChange={event => { setDraft(event.target.value); setError(''); }} onBlur={() => { const value = Number(draft); if (!draft.trim() || !Number.isFinite(value) || value < 1 || value > 60) { setError('Use 1–60 seconds. Previous duration kept.'); setDraft(String(duration)); return; } onDuration(value); }} /></div><span className="frame-timecode">{formatTime(frame.startTime)} → {formatTime(frame.endTime)}</span>{error && <p className="error-message" role="alert">{error}</p>}<label className="field-label" htmlFor={`prompt-${frame.id}`}>Image prompt</label><textarea id={`prompt-${frame.id}`} aria-label={`Frame ${index + 1} image prompt`} maxLength={2000} rows={3} value={frame.prompt} onChange={event => onPrompt(event.target.value)} /></div></article>;
}

export function StoryboardEditor({ frames, onMove, onDuration, onPrompt }: { frames: readonly StoryboardFrame[]; onMove: (id: string, offset: -1 | 1) => void; onDuration: (id: string, seconds: number) => void; onPrompt: (id: string, prompt: string) => void }) {
  return <div className="storyboard-editor">{frames.map((frame, index) => <FrameEditor key={frame.id} frame={frame} index={index} count={frames.length} onMove={offset => onMove(frame.id, offset)} onDuration={seconds => onDuration(frame.id, seconds)} onPrompt={prompt => onPrompt(frame.id, prompt)} />)}</div>;
}
