import { cn } from '../lib/utils';

export function AnimatedWaveform({ active }: { active: boolean }) {
  return <div className={cn('live-wave', active && 'is-active')} role="img" aria-label={`Simulated audio waveform, ${active ? 'active' : 'idle'}`}>
    {Array.from({ length: 36 }, (_, index) => <span key={index} style={{ height: `${20 + (index * 29 % 72)}%`, animationDelay: `${index * -73}ms`, animationDuration: `${470 + index % 7 * 95}ms` }} />)}
    <span className="wave-label">SIMULATED WAVEFORM</span>
  </div>;
}
