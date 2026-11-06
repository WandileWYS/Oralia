import { useState } from 'react';
import { ArrowUpRight, BookOpen, Check, Clock3, Flower2, Globe2, Headphones, Mountain, Telescope } from 'lucide-react';
import { ageTiers, type AgeTier, type Story } from '../types/story';
import { tierStyles } from '../data/presentation';
import { cn, formatTime } from '../lib/utils';
import { filterEducationStories, type EducationFilter } from '../lib/education';
import { EducationThemeBadge } from './EducationThemeBadge';
import { storyHref } from '../lib/catalog';
import { SceneThumbnail } from './SceneThumbnail';

const icons = [Flower2, Mountain, Telescope, BookOpen];
const collections = [
  { id: 'all', label: 'All stories' },
  { id: 'southern-africa', label: 'Southern African Tales' },
  { id: 'west-africa', label: 'West African Folklore' },
  { id: 'zulu', label: 'Zulu Mythology' },
  { id: 'east-africa', label: 'East African Fables' },
] as const;

export function EducationFeed({ ageTier, onAgeTierChange, stories }: {
  ageTier: AgeTier;
  onAgeTierChange: (tier: AgeTier) => void;
  stories: readonly Story[];
}) {
  const [collection, setCollection] = useState<EducationFilter>('all');
  const entries = filterEducationStories(stories, ageTier, collection);
  const selected = collections.find(item => item.id === collection)!;

  const chooseTier = (tier: AgeTier) => {
    onAgeTierChange(tier);
  };
  const chooseCollection = (next: EducationFilter) => {
    setCollection(next);
  };

  return <div className="education-experience" data-age-tier={ageTier}>
    <div className="page-intro">
      <div><span className="eyebrow text-clay">THE LEARNING CIRCLE</span><h1>Big imaginations.<br /><em>Growing perspectives.</em></h1><p>A world of stories, thoughtfully illustrated for every age.</p></div>
      <div className="intro-note"><BookOpen size={25} /><p>Same original voice.<br />A new way to see the story.</p></div>
    </div>

    <div className="tier-grid" role="group" aria-label="Choose an age tier">
      {ageTiers.map((tier, index) => {
        const Icon = icons[index];
        const style = tierStyles[tier];
        return <button type="button" key={tier} className={cn('tier-card', tier === ageTier && 'selected')} onClick={() => chooseTier(tier)} aria-pressed={tier === ageTier} aria-label={`Ages ${tier.replace('-', '–')}: ${style.label}`}>
          <span className="tier-card-icons"><Icon size={23} aria-hidden="true" />{tier === ageTier && <Check size={17} aria-hidden="true" />}</span>
          <strong>Ages {tier.replace('-', '–')}</strong><span className="tier-title">{style.label}</span><span className="tier-description">{style.description}</span>
          <EducationThemeBadge ageTier={tier} />
        </button>;
      })}
    </div>

    <section className="collection-section" aria-label="Browse regions and traditions">
      <div className="collection-heading"><Globe2 size={17} /><span>Across places. Across generations.</span></div>
      <div className="collection-filters" role="group" aria-label="Region and tradition filters">
        {collections.map(item => <button type="button" key={item.id} aria-pressed={collection === item.id} className={cn('collection-tab', collection === item.id && 'selected')} onClick={() => chooseCollection(item.id)}>
          {item.label}<span aria-label={`${filterEducationStories(stories, ageTier, item.id).length} stories`}>{filterEducationStories(stories, ageTier, item.id).length}</span>
        </button>)}
      </div>
    </section>

    <div className="education-note" role="status" aria-live="polite" aria-atomic="true"><Check size={16} /><span>Ages {ageTier.replace('-', '–')} · Narration-aligned captions · {entries.length} matching {entries.length === 1 ? 'story' : 'stories'}</span></div>
    {entries.length > 0 ? <section className="education-results" aria-labelledby="education-results-title">
      <div className="education-results-heading"><div><span className="eyebrow">A MOMENT TO LISTEN</span><h2 id="education-results-title">Stories for {tierStyles[ageTier].label.toLowerCase()}</h2></div><EducationThemeBadge ageTier={ageTier} /></div>
      <div className="education-story-grid">
        {entries.map(({ story, variant }) => <article key={story.id} className="education-story education-story-card">
          <a className="education-card-open" aria-label={`Open ${story.title} for ages ${ageTier.replace('-', '–')}`} aria-haspopup="dialog" href={storyHref(story.id)}>
            <span className="education-card-art"><SceneThumbnail frame={variant.keyframes[0]} loading="eager" /><span className="education-card-vignette" /><span className="education-cover-label"><Headphones size={14} />READ & LISTEN</span><span className="education-cover-play"><Headphones size={24} /></span><span className="education-cover-scenes">{variant.keyframes.length} illustrated scenes</span></span>
            <span className="education-card-copy"><span className="eyebrow">{story.category}</span><span className="education-card-title">{story.title}</span><span className="education-card-description">{story.description}</span><EducationThemeBadge ageTier={ageTier} /><span className="education-card-meta"><span><Clock3 size={13} />{formatTime(story.audio.durationSeconds)} listen</span><span>Ages {ageTier.replace('-', '–')}</span></span><span className="education-card-cta">Step inside the story <ArrowUpRight size={17} /></span></span>
          </a>
        </article>)}
      </div>
      <p className="education-curation-note">English adaptations of attributed tales. Scene photography is editorial; each Listening Room includes the collection source and cultural context.</p>
    </section> : <div className="empty-state collection-empty" role="status">
      <Globe2 size={36} /><span className="eyebrow">A COLLECTION WAITING TO GROW</span><h2>No reviewed stories in {selected.label} for ages {ageTier.replace('-', '–')} yet.</h2>
      <p>Only approved variants for your selected age tier appear here. Regional collections also need reviewed recordings and cultural attribution.</p>
      {collection !== 'all' && <button type="button" className="secondary-button" onClick={() => chooseCollection('all')}>Explore all stories</button>}
    </div>}
  </div>;
}
