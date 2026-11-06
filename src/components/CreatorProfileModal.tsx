import { collectionLabels } from '../types/story';
import { ArrowLeft, BookOpen, X } from 'lucide-react';
import { useId } from 'react';
import type { CreatorProfile } from '../types/creator';
import { collectionOptions, type CollectionFilter, type Story } from '../types/story';
import { useModalDialog } from '../hooks/useModalDialog';
import { getCreatorStories } from '../lib/catalog';
import { CreatorAvatar } from './CreatorByline';
import { StoryCard } from './StoryCard';
import { DropdownSelect } from './DropdownSelect';

export function CreatorProfileModal({ creator, stories, collection, onCollectionChange, onClose }: { creator: CreatorProfile; stories: readonly Story[]; collection: CollectionFilter; onCollectionChange: (tier: CollectionFilter) => void; onClose: () => void }) {
  const { dialog } = useModalDialog();
  const titleId = useId();
  const entries = getCreatorStories(stories, creator.id, collection);
  const total = stories.filter(story => story.creatorId === creator.id && story.publishedAt).length;
  return <dialog ref={dialog} className="creator-profile-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="profile-dialog-shell"><header className="profile-dialog-header"><button type="button" className="secondary-button" onClick={onClose}><ArrowLeft size={15} />Back to Vellum feed</button><button type="button" className="icon-button" aria-label="Close creator profile" onClick={onClose} autoFocus><X size={20} /></button></header>
      <section className="creator-profile-hero"><CreatorAvatar creator={creator} large /><div><span className="eyebrow text-clay">PUBLIC CREATOR PROFILE</span><h1 id={titleId}>{creator.name}</h1><p className="profile-handle">@{creator.username}</p><p>{creator.bio}</p><span className="profile-publication-count"><BookOpen size={15} />{total} published {total === 1 ? 'story' : 'stories'} · No sign-in needed to listen</span></div></section>
      <section className="profile-stories" aria-labelledby="profile-stories-title"><div className="discovery-section-heading"><div><span className="eyebrow">THEIR CORNER OF VELLUM</span><h2 id="profile-stories-title">Published stories</h2><p className="helper-text">{entries.length} available in {collectionLabels[collection]}</p></div><DropdownSelect label="Profile collection" value={collection} options={collectionOptions} onChange={onCollectionChange} /></div>
        {entries.length ? <div className="profile-story-grid">{entries.map(entry => <StoryCard key={entry.story.id} entry={entry} creator={creator} />)}</div> : <div className="collection-empty empty-state"><BookOpen size={28} /><h2>A story for another chapter.</h2><p>No published stories in this literary collection. Choose another collection above.</p></div>}
      </section>
    </div>
  </dialog>;
}
