import { Sparkles } from 'lucide-react';
import { collectionStyles } from '../data/presentation';
import type { StoryCollection } from '../types/story';
export function EducationThemeBadge({collection}: {collection: StoryCollection}) { return <span className="education-theme-pill" data-collection={collection}><Sparkles size={12} aria-hidden="true" />{collectionStyles[collection].theme}</span>; }
