import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Volume2, VolumeX } from 'lucide-react';
import { cn } from '../lib/utils';

export function VolumeControl({ volume, muted, onVolumeChange, onToggleMute, subject = 'story' }: { volume: number; muted: boolean; onVolumeChange: (volume: number) => void; onToggleMute: () => void; subject?: 'story' | 'pitch' }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const percent = muted ? 0 : Math.round(volume * 100);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  return <div ref={container} className={cn('volume-control', muted && 'is-muted')} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); expandButton.current?.focus(); }
  }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <div className="volume-pill rounded-full transition-all duration-300">
      <button type="button" className={cn('icon-button volume-mute', muted && 'active')} aria-label={`${muted ? 'Unmute' : 'Mute'} ${subject}`} aria-pressed={muted} title={`${muted ? 'Unmute' : 'Mute'} ${subject}`} onClick={onToggleMute}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button>
      <button ref={expandButton} type="button" className="volume-expand" aria-label={subject === 'story' ? 'Adjust volume' : 'Adjust pitch volume'} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)} title={`Volume ${percent}%`}><span>{percent}%</span><ChevronDown size={11} /></button>
    </div>
    {open && <div id={panelId} className="volume-panel" role="group" aria-label="Volume controls"><div><strong>Volume</strong><span>{muted ? 'Muted' : `${percent}%`}</span></div><input aria-label={`${subject === 'story' ? 'Story' : 'Pitch'} volume`} type="range" min="0" max="100" step="1" value={percent} aria-valuetext={muted ? 'Muted' : `${percent} percent`} onChange={event => onVolumeChange(Number(event.target.value) / 100)} style={{ background: `linear-gradient(to right, var(--accent) ${percent}%, var(--border) ${percent}%)` }} /><span className="volume-hint">{muted ? 'Raise volume to unmute' : 'Drag to find your listening level'}</span></div>}
  </div>;
}
