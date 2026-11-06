import { useEffect, useRef } from 'react';
import { Languages, ScrollText } from 'lucide-react';
import type { Keyframe } from '../types/story';
import { cn, formatTime } from '../lib/utils';
import { DropdownSelect, type DropdownOption } from './DropdownSelect';

export const captionLanguages = { en: 'English' } as const;
export type CaptionLanguage = keyof typeof captionLanguages;
const languageOptions: readonly DropdownOption<CaptionLanguage>[] = [
  { value: 'en', label: 'English' },
];

interface Props {
  frames: readonly Keyframe[];
  activeIndex: number;
  language: CaptionLanguage;
  overlay: boolean;
  onLanguageChange: (language: CaptionLanguage) => void;
  onOverlayChange: () => void;
  onSeek: (seconds: number) => void;
  canSeek: boolean;
}

export function CaptionTranscript({ frames, activeIndex, language, overlay, onLanguageChange, onOverlayChange, onSeek, canSeek }: Props) {
  const pane = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = pane.current;
    const active = container?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!container || !active) return;
    const top = active.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - container.clientHeight / 2 + active.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [activeIndex, language]);

  return <section className="transcript-panel" aria-label="Synchronized transcript">
    <div className="transcript-toolbar"><span><ScrollText size={16} />Read along <i>Auto-scroll</i></span><div className="caption-settings"><DropdownSelect className="caption-dropdown" label="Caption language" icon={<Languages size={15} />} value={language} options={languageOptions} onChange={onLanguageChange} /><button onClick={onOverlayChange} aria-pressed={overlay} className={cn('overlay-toggle', overlay && 'active')}>Dialect overlay <span /></button></div></div>
    {overlay && <p className="translation-notice">English adaptation captions. No reviewed dialect track is supplied for this collection.</p>}
    <div className="transcript-scroll" ref={pane} tabIndex={0} aria-label="Scrollable caption cues">{frames.map((frame, index) => <button key={frame.id} className={cn('transcript-cue', activeIndex === index && 'active')} aria-current={activeIndex === index ? 'true' : undefined} disabled={!canSeek} onClick={() => onSeek(frame.startTime)}><time>{formatTime(frame.startTime)}</time><span>{frame.caption}</span></button>)}</div>
  </section>;
}
