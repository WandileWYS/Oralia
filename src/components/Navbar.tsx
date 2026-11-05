import { useState } from 'react';
import { AudioLines, BookOpen, Compass, Layers3, Menu, Moon, Sun, X } from 'lucide-react';
import { ageTiers, type AgeTier } from '../types/story';
import type { AppMode } from '../types/mode';
import { cn } from '../lib/utils';

interface NavbarProps { mode: AppMode; onModeChange: (mode: AppMode) => void; ageTier: AgeTier; onAgeTierChange: (tier: AgeTier) => void; theme: 'dark' | 'light'; onThemeChange: () => void }
const modes = [
  { id: 'social_reel', label: 'Social Reel', icon: Compass },
  { id: 'creator_studio', label: 'Creator Studio', icon: Layers3 },
  { id: 'education', label: 'Education', icon: BookOpen },
] as const;

export function Navbar({ mode, onModeChange, ageTier, onAgeTierChange, theme, onThemeChange }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <header className="site-header">
    <a href="#main" className="skip-link">Skip to content</a>
    <button className="brand" onClick={() => onModeChange('social_reel')} aria-label="Oralia home"><span className="brand-icon"><AudioLines size={25} /></span>oralia<span className="brand-period">.</span></button>
    <div className="header-tools"><label className="age-dropdown"><span>Listening age</span><select value={ageTier} onChange={event => onAgeTierChange(event.target.value as AgeTier)} aria-label="Listening age tier">{ageTiers.map(tier => <option key={tier} value={tier}>{tier === '18+' ? '18+' : tier.replace('-', '–')} years</option>)}</select></label><button className="icon-button theme-toggle" onClick={onThemeChange} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button><button className="icon-button mobile-menu-toggle" aria-label="Toggle navigation" aria-controls="mode-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button><span className="avatar small" aria-label="Demo profile">O</span></div>
    <nav id="mode-navigation" aria-label="Main navigation" className={cn('mode-nav', menuOpen && 'is-open')}>
      {modes.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => { onModeChange(id); setMenuOpen(false); }} className={cn('nav-tab', mode === id && 'selected')} aria-current={mode === id ? 'page' : undefined}><Icon size={17} /><span>{label}</span><i /></button>)}
    </nav>
  </header>;
}
