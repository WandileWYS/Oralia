import { useId } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import type { CreatorProfile } from '../types/creator';
import type { Story, StoryVariant } from '../types/story';
import { useModalDialog } from '../hooks/useModalDialog';
import { CarouselPlayer } from './CarouselPlayer';
import { EducationThemeBadge } from './EducationThemeBadge';

export function ListeningRoomModal({ story, variant, creator, returnLabel, onClose }: {
  story: Story; variant: StoryVariant; creator?: CreatorProfile; returnLabel: string; onClose: () => void;
}) {
  const { dialog } = useModalDialog();
  const titleId = useId();
  return <dialog ref={dialog} className="education-reader-dialog education-experience listening-room-dialog" data-age-tier={variant.ageTier} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="education-reader-shell"><header className="education-reader-header listening-room-header"><button type="button" className="secondary-button reader-back-pill" onClick={onClose}><ArrowLeft size={15} />{returnLabel}</button><div><span className="eyebrow">THE LISTENING ROOM · AGES {variant.ageTier.replace('-', '–')}</span><h2 id={titleId}>{story.title}</h2></div><button type="button" className="icon-button education-reader-close" aria-label="Close listening room" onClick={onClose} autoFocus><X size={20} /></button></header>
      <div className="education-story education-reader-content"><div className="education-theme-banner"><span>A world in every voice.</span><EducationThemeBadge ageTier={variant.ageTier} /></div><CarouselPlayer story={story} variant={variant} creator={creator} /></div>
    </div>
  </dialog>;
}
