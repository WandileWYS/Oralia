import { cn, formatTime } from '../lib/utils';

export function PlaybackWaveform({ currentTime, duration, playing, onSeek }: { currentTime: number; duration: number; playing: boolean; onSeek: (seconds: number) => void }) {
  const progress = duration > 0 ? Math.min(100, currentTime / duration * 100) : 0;
  return <div className={cn('waveform-seek', playing && 'is-playing')} title="Click or drag the waveform to seek">
    <div className="waveform" aria-hidden="true">{Array.from({ length: 64 }, (_, index) => <span key={index} className={index / 64 * 100 < progress ? 'heard' : ''} style={{ height: `${18 + (index * 31 + 17) % 65}%`, animationDelay: `${index * -43}ms`, animationDuration: `${560 + index % 6 * 85}ms` }} />)}</div>
    <input className="waveform-input" aria-label="Waveform progress" aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`} type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration)} disabled={!duration} onChange={event => onSeek(Number(event.target.value))} />
    <span className="waveform-position" style={{ left: `${progress}%` }} aria-hidden="true" />
  </div>;
}
