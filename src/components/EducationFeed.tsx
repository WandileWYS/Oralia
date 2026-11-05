import { useState } from 'react';
import { BookOpen, Check, Flower2, Globe2, Mountain, Sparkles, Telescope } from 'lucide-react';
import { ageTiers, type AgeTier, type Story } from '../types/story';
import { tierStyles } from '../data/mockStories';
import { cn } from '../lib/utils';
import { CarouselPlayer } from './CarouselPlayer';

const icons = [Flower2, Mountain, Telescope, BookOpen];
const collections = [
  { id: 'all', label: 'All stories' },
  { id: 'originals', label: 'Original demos' },
  { id: 'west-africa', label: 'West African Folklore' },
  { id: 'zulu', label: 'Zulu Mythology' },
  { id: 'east-africa', label: 'East African Fables' },
] as const;
const themeNames: Record<AgeTier, string> = { '5-9': 'A little fairytale magic', '10-13': 'Adventure, panel by panel', '14-17': 'Stories with a darker edge', '18+': 'A cinematic moment' };
export function EducationFeed({ ageTier, onAgeTierChange, story }: { ageTier: AgeTier; onAgeTierChange: (tier: AgeTier) => void; story: Story }) {
  const [collection, setCollection] = useState<(typeof collections)[number]['id']>('all');
  const variant = story.tierVariants[ageTier];
  const available = variant?.reviewStatus === 'approved';
  const collectionMatches = collection === 'all' || collection === 'originals';
  const selected = collections.find(item => item.id === collection)!;
  return <div className="education-experience" data-age-tier={ageTier}>
    <div className="page-intro"><div><span className="eyebrow text-clay">THE LEARNING CIRCLE</span><h1>Big imaginations.<br /><em>Growing perspectives.</em></h1><p>A world of stories, thoughtfully illustrated for every age.</p></div><div className="intro-note"><BookOpen size={25} /><p>Same original voice.<br />A new way to see the story.</p></div></div>
    <div className="tier-grid" role="group" aria-label="Choose an age tier">{ageTiers.map((tier, index) => { const Icon = icons[index]; const style = tierStyles[tier]; return <button key={tier} className={cn('tier-card', tier === ageTier && 'selected')} onClick={() => onAgeTierChange(tier)} aria-pressed={tier === ageTier}><div className="flex items-center justify-between"><Icon size={23} />{tier === ageTier && <Check size={17} />}</div><strong>Ages {tier.replace('-', '–')}</strong><h3>{style.label}</h3><p>{style.description}</p><span className="tier-style"><Sparkles size={12} />{style.theme}</span></button>; })}</div>
    <section className="collection-section" aria-label="Browse regions and traditions"><div className="collection-heading"><Globe2 size={17} /><span>Across places. Across generations.</span></div><div className="collection-filters" role="group" aria-label="Region and tradition filters">{collections.map(item => <button key={item.id} aria-pressed={collection === item.id} className={cn('collection-tab', collection === item.id && 'selected')} onClick={() => setCollection(item.id)}>{item.label}<span>{available && (item.id === 'all' || item.id === 'originals') ? 1 : 0}</span></button>)}</div></section>
    <div className="education-note"><Check size={16} /><span>Curated demo for ages {ageTier.replace('-', '–')} · Original captions preserved · {available && collectionMatches ? 1 : 0} matching stories</span></div>
    {available && collectionMatches ? <section className="education-story"><div className="education-theme-banner"><Sparkles size={16} /><span>{themeNames[ageTier]}</span><i>{tierStyles[ageTier].theme}</i></div><CarouselPlayer key={ageTier} story={story} variant={variant} /></section> : <div className="empty-state collection-empty" role="status"><Globe2 size={36} /><span className="eyebrow">A COLLECTION WAITING TO GROW</span><h2>{collectionMatches ? 'This age variant is not ready yet.' : `No reviewed stories in ${selected.label} yet.`}</h2><p>Regional collections need reviewed recordings and cultural attribution. Our original demo fiction is available in All stories and Original demos.</p><button className="secondary-button" onClick={() => setCollection('all')}>Explore all stories</button></div>}
  </div>;
}
