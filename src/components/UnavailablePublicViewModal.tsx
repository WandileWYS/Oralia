import { BookOpen, X } from 'lucide-react';
import { useModalDialog } from '../hooks/useModalDialog';
import { ageTiers, type AgeTier } from '../types/story';
import { DropdownSelect } from './DropdownSelect';

const ageOptions = ageTiers.map(value => ({ value, label: `Ages ${value.replace('-', '–')}` }));
export function UnavailablePublicViewModal({ ageTier, canChangeAge, onAgeTierChange, onClose }: { ageTier: AgeTier; canChangeAge: boolean; onAgeTierChange: (tier: AgeTier) => void; onClose: () => void }) {
  const { dialog } = useModalDialog();
  return <dialog ref={dialog} className="creator-signin-dialog unavailable-public-dialog" aria-labelledby="unavailable-public-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}><div className="creator-signin-content"><button type="button" className="icon-button signin-close" aria-label="Close unavailable page" onClick={onClose}><X size={20} /></button><BookOpen size={32} /><h2 id="unavailable-public-title">{canChangeAge ? 'A story for another chapter.' : 'This page is not in our collection.'}</h2><p>{canChangeAge ? `This story has no approved variant for ages ${ageTier.replace('-', '–')}. Choose another listening age.` : 'The story or creator link may have changed.'}</p>{canChangeAge && <DropdownSelect label="Story listening age" value={ageTier} options={ageOptions} onChange={onAgeTierChange} />}<button type="button" className="secondary-button" onClick={onClose}>Back to Vellum feed</button></div></dialog>;
}
