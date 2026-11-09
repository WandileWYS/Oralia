import { DropdownSelect } from './DropdownSelect';
import {languageOptions,type LanguageFilter} from '../types/language';
import { collectionLabels } from '../types/story';
import { useState } from 'react';
import { ArrowUpRight, AudioLines, Headphones, Search, Sparkles, X } from 'lucide-react';
import { collectionOptions, type CollectionFilter, type Story } from '../types/story';
import type { CreatorProfile } from '../types/creator';
import { creatorHref, getPlayableStories } from '../lib/catalog';
import { cn } from '../lib/utils';
import { StoryCard } from './StoryCard';
import { CreatorAvatar } from './CreatorByline';

export function VellumFeed({ stories, creators, collection, onCollectionChange, onCreate,language,onLanguageChange,pending,error,onRetry }: {
  language:LanguageFilter;onLanguageChange:(value:LanguageFilter)=>void;pending:boolean;error:string;onRetry:()=>void;stories: readonly Story[]; creators: readonly CreatorProfile[]; collection: CollectionFilter; onCollectionChange: (value: CollectionFilter) => void; onCreate: () => void;
}) {
  const [query, setQuery] = useState('');
  const playable = getPlayableStories(stories, collection).filter(({ story }) => story.publishedAt);
  const entries = playable.filter(({ story }) => `${story.title} ${story.description} ${story.category} ${story.creator}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const featured = entries.filter(({ story }) => story.featured);
  const recent = entries.filter(({ story }) => !story.featured).sort((a, b) => (b.story.publishedAt ?? '').localeCompare(a.story.publishedAt ?? ''));
  const voices = creators.filter(creator => entries.some(({ story }) => story.creatorId === creator.id));
  const creatorFor = (story: Story) => creators.find(creator => creator.id === story.creatorId);

  return <div className="vellum-feed">
    <div className="page-intro"><div><span className="eyebrow text-clay"><span className="tiny-line" />VELLUM · A WORLD IN EVERY VOICE</span><h1>Stories to get lost in.<br /><em>Voices to come home to.</em></h1><p>Discover something worth listening to. No account needed.</p></div><div className="intro-note"><Headphones size={26} strokeWidth={1.3} /><p>One voice. A world of scenes.<br />A little room for wonder.</p></div></div>
    <section className="discovery-toolbar" aria-label="Filter Vellum stories"><div className="discovery-collection-filters" role="group" aria-label="Vellum collections">{collectionOptions.map(({value: value, label}) => <button type="button" key={value} className={cn('discovery-collection-pill', value === collection && 'selected')} aria-pressed={value === collection} onClick={() => onCollectionChange(value)}>{label}</button>)}</div><DropdownSelect label="Filter by Language" value={language} options={[{value:"ALL" as const,label:"All Languages"},...languageOptions]} onChange={onLanguageChange}/><label className="discovery-search"><Search size={16} /><span className="sr-only">Search Vellum stories</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a story or a voice…" />{query && <button type="button" className="icon-button" aria-label="Clear story search" onClick={() => setQuery('')}><X size={14} /></button>}</label></section>
    {pending&&<p role="status">Loading matching stories…</p>}{error&&<p role="alert">{error} <button className="secondary-button" onClick={onRetry}>Retry discovery</button></p>}<p className="discovery-result-count" role="status">{entries.length} {entries.length === 1 ? 'story' : 'stories'} in {collectionLabels[collection]} · Source-attributed collection</p>
    {featured.length > 0 && <section className="discovery-section" aria-labelledby="featured-vellum"><div className="discovery-section-heading"><div><span className="eyebrow">TAKE A MOMENT. FIND YOUR STORY.</span><h2 id="featured-vellum">Featured Vellum</h2></div><span className="discovery-section-note"><Sparkles size={14} />Thoughtfully picked</span></div><div className="featured-vellum-grid">{featured.map(entry => <StoryCard key={entry.story.id} entry={entry} creator={creatorFor(entry.story)} featured />)}</div></section>}
    {voices.length > 0 && <section className="discovery-section" aria-labelledby="trending-voices"><div className="discovery-section-heading"><div><span className="eyebrow">MEET THE PEOPLE BEHIND THE WORDS</span><h2 id="trending-voices">Trending Voices</h2></div><span className="discovery-section-note">Editorial selection · not live rankings</span></div><div className="creator-spotlight-grid">{voices.map(creator => <a key={creator.id} className="creator-spotlight" href={creatorHref(creator.username)} aria-label={`Explore @${creator.username}'s creator profile`} aria-haspopup="dialog"><CreatorAvatar creator={creator} /><span><strong>{creator.name}</strong><small>@{creator.username} · {entries.filter(entry=>entry.story.creatorId===creator.id).length} stories for this collection</small></span><ArrowUpRight size={18} /></a>)}</div></section>}
    {recent.length > 0 && <section className="discovery-section" aria-labelledby="recent-chronicles"><div className="discovery-section-heading"><div><span className="eyebrow">A NEW CHAPTER IS ALWAYS WAITING</span><h2 id="recent-chronicles">Recent Chronicles</h2></div><span className="discovery-section-note">Latest in the story collection</span></div><div className="discovery-grid">{recent.map(entry => <StoryCard key={entry.story.id} entry={entry} creator={creatorFor(entry.story)} />)}</div></section>}
    {!pending&&!error&&entries.length === 0 && <section className="collection-empty empty-state" aria-label="No matching stories"><Search size={30} /><h2>No stories found this time.</h2><p>Try another title, creator, language, or collection.</p>{query && <button type="button" className="secondary-button" onClick={() => setQuery('')}>Clear search</button>}</section>}
    <div className="invitation"><div className="invitation-icon"><AudioLines size={26} /></div><div><h3>Your voice belongs here.</h3><p>Have a world in mind? Give it a voice in Creator Studio.</p></div><button type="button" className="secondary-button" onClick={onCreate}>Tell your story <ArrowUpRight size={16} /></button></div>
  </div>;
}
