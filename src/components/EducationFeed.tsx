import { useState } from 'react';
import { BookOpen, Check, Globe2 } from 'lucide-react';
import { storyCollections, collectionLabels, type CollectionFilter, type Story } from '../types/story';
import { collectionStyles } from '../data/presentation';
import { filterEducationStories, type RegionFilter } from '../lib/education';
import { StoryCard } from './StoryCard';
import { EducationThemeBadge } from './EducationThemeBadge';
import type { CreatorProfile } from '../types/creator';
const regions = [{value:'all',label:'All regions'},{value:'west-africa',label:'West African Folklore'},{value:'zulu',label:'Zulu Mythology'},{value:'east-africa',label:'East African Fables'},{value:'southern-africa',label:'Southern African Tales'}] as const;
export function EducationFeed({collection,onCollectionChange,stories,creators}: {collection:CollectionFilter;onCollectionChange:(value:CollectionFilter)=>void;stories:readonly Story[];creators:readonly CreatorProfile[]}) {
 const [region,setRegion]=useState<RegionFilter>('all');const entries=filterEducationStories(stories,collection,region);
 return <div className="education-experience"><div className="page-intro"><div><span className="eyebrow text-clay">THE LEARNING CIRCLE</span><h1>Stories to explore.<br/><em>Perspectives to discover.</em></h1><p>Explore fables, origin narratives, and journeys through their literary traditions.</p></div><div className="intro-note"><BookOpen size={25}/><p>A world in every voice.<br/>A new way to see a story.</p></div></div>
 <div className="thematic-grid" role="group" aria-label="Education collections">{storyCollections.map(value=><button type="button" className={'thematic-card '+(collection===value?'selected':'')} key={value} aria-pressed={collection===value} onClick={()=>onCollectionChange(value)}><strong>{collectionLabels[value]}</strong><p>{collectionStyles[value].description}</p><EducationThemeBadge collection={value}/></button>)}</div>
 <button type="button" className="secondary-button" aria-pressed={collection==='ALL'} onClick={()=>onCollectionChange('ALL')}>All Collections</button>
 <section className="collection-section" aria-label="Browse regions and traditions"><div className="collection-heading"><Globe2 size={17}/>Across places. Across generations.</div><div className="collection-filters" role="group" aria-label="Region and tradition filters">{regions.map(item=><button type="button" className={'collection-tab '+(region===item.value?'selected':'')} key={item.value} aria-pressed={region===item.value} onClick={()=>setRegion(item.value)}>{item.label}<span>{filterEducationStories(stories,collection,item.value).length}</span></button>)}</div></section>
 <p className="education-note" role="status"><Check size={16}/>{collectionLabels[collection]} · Narration-aligned captions · {entries.length} stories</p>
 {entries.length ? <div className="discovery-grid">{entries.map(entry=><div className="education-story" data-collection={entry.story.collection} key={entry.story.id}><StoryCard entry={entry} creator={creators.find(creator=>creator.id===entry.story.creatorId)}/></div>)}</div> : <div className="collection-empty empty-state"><h2>No published stories in this selection yet.</h2><p>Try another literary collection or region.</p><button type="button" className="secondary-button" onClick={()=>{setRegion('all');onCollectionChange('ALL')}}>Explore all stories</button></div>}
 <p className="education-curation-note">Source-attributed English adaptations. Literary collections describe narrative character; each Listening Room includes source and cultural context.</p></div>;
}
