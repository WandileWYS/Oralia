import { collectionLabels } from '../types/story';
import { ArrowUpRight, Clock3, Headphones } from 'lucide-react';
import type { CreatorProfile } from '../types/creator';
import { storyHref, type StoryEntry } from '../lib/catalog';
import { cn, formatTime } from '../lib/utils';
import { SceneThumbnail } from './SceneThumbnail';
import { CreatorByline } from './CreatorByline';

export function StoryCard({ entry: { story, presentation }, creator, featured = false }: { entry: StoryEntry; creator?: CreatorProfile; featured?: boolean }) {
  return <article data-collection={story.collection} className={cn('discovery-card', featured && 'featured')}>
    <a className="discovery-card-open" href={storyHref(story.id)} aria-label={`Listen to ${story.title}`} aria-haspopup="dialog">
      <div className="discovery-card-cover"><SceneThumbnail frame={presentation.keyframes[0]} alt={presentation.keyframes[0].altText} fullSize={featured} loading={featured ? 'eager' : 'lazy'} /><span className="discovery-cover-vignette" /><span className="discovery-listen-pill"><Headphones size={13} />{featured ? 'THE EDITOR’S PICK' : 'ORALIA · SOURCED TALE'}</span><span className="discovery-play"><Headphones size={23} /></span><span className="discovery-scene-count">{presentation.keyframes.length} scenes · Oral storytelling</span></div>
      <div className="discovery-card-copy"><div className="discovery-tags"><span>{collectionLabels[story.collection]}</span><span>{story.category}</span></div><h3>{story.title}</h3><p>{story.description}</p><span className="discovery-card-cta"><span><Clock3 size={13} />{formatTime(story.audio.durationSeconds)} listen</span><span>Enter the Listening Room <ArrowUpRight size={16} /></span></span></div>
    </a>
    <footer className="discovery-card-footer">{creator ? <CreatorByline creator={creator} /> : <span>By {story.creator}</span>}<span className="discovery-original">English adaptation</span></footer>
  </article>;
}
