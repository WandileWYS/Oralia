import { Sparkles } from 'lucide-react';
import { tierStyles } from '../data/presentation';
import type { AgeTier } from '../types/story';

export function EducationThemeBadge({ ageTier }: { ageTier: AgeTier }) {
  return <span className="education-theme-pill" data-age-tier={ageTier}><Sparkles size={12} aria-hidden="true" />{tierStyles[ageTier].theme}</span>;
}
