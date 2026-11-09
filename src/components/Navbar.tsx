import { collectionLabels } from '../types/story';
import { useRef, useState } from 'react';
import { AudioLines, BookOpen, Compass, Layers3, LogOut, Mail, Menu, Moon, Sun, X } from 'lucide-react';
import { collectionOptions, type CollectionFilter } from '../types/story';
import type { AppMode } from '../types/mode';
import { cn } from '../lib/utils';
import { DropdownSelect } from './DropdownSelect';
import type { CreatorSession } from '../types/creator';
import { creatorHref } from '../lib/catalog';

interface NavbarProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  collection: CollectionFilter;
  onCollectionChange: (value: CollectionFilter) => void;
  theme: 'dark' | 'light';
  onThemeChange: () => void;
  session: CreatorSession | null;
  onCreatorAuth: () => void;
}
const modes = [
  { id: 'vellum', label: 'Vellum', icon: Compass },
  { id: 'creator_studio', label: 'Creator Studio', icon: Layers3 },
  { id: 'studio_foundry', label: 'Studio Foundry', icon: Layers3 },
  { id: 'education', label: 'Education', icon: BookOpen },
] as const;

function AccountAvatar({ session }: { session: CreatorSession }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const initials = session.displayName.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || session.username.slice(0, 2).toUpperCase();
  return <span className="account-avatar" aria-hidden="true">{initials}{session.avatarUrl && failedSource !== session.avatarUrl && <img src={session.avatarUrl} alt="" onError={() => setFailedSource(session.avatarUrl)} />}</span>;
}

export function Navbar({ mode, onModeChange, collection, onCollectionChange, theme, onThemeChange, session, onCreatorAuth }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const activeMode = modes.find(item => item.id === mode)!;
  const selectMode = (nextMode: AppMode) => {
    onModeChange(nextMode);
    setMenuOpen(false);
  };

  return (
    <header className="site-header">
      <a href="#main" className="skip-link">Skip to content</a>
      <button type="button" className="brand" onClick={() => selectMode('vellum')} aria-label="Oralia home">
        <span className="brand-icon"><AudioLines size={25} /></span>
        <span className="brand-wordmark">oralia<span className="brand-period">.</span></span>
      </button>

      <div className="header-tools">
        <DropdownSelect className="collection-dropdown" label="Story collection" eyebrow="Collection" value={collection} options={collectionOptions} onChange={onCollectionChange} />
        <button type="button" className="icon-button theme-toggle rounded-full transition-all duration-300" onClick={onThemeChange} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
          {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
        </button>
        <button
          ref={menuButton}
          type="button"
          className="icon-button mobile-menu-toggle rounded-full transition-all duration-300"
          aria-label="Toggle navigation"
          aria-controls="mode-navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(value => !value)}
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        {session ? <div className="header-account"><a className="header-identity" href={creatorHref(session.username)} aria-label={`View @${session.username}'s creator profile`} title={`@${session.username}`}><AccountAvatar key={session.id} session={session} /><span className="header-username">@{session.username}</span></a><button type="button" className="icon-button" aria-label="Sign out creator" title="Sign out" onClick={onCreatorAuth}><LogOut size={16} /></button></div> : <button type="button" className="header-auth-button" aria-label="Creator sign in" onClick={onCreatorAuth}><Mail size={16} /><span>Creator sign in</span></button>}
      </div>

      <nav
        id="mode-navigation"
        aria-label="Main navigation"
        className={cn('mode-nav rounded-full transition-all duration-300', menuOpen && 'is-open')}
        onKeyDown={event => {
          if (event.key === 'Escape' && menuOpen) {
            setMenuOpen(false);
            menuButton.current?.focus();
          }
        }}
      >
        {modes.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            onClick={() => selectMode(id)}
            className={cn('nav-tab rounded-full transition-all duration-300', mode === id && 'selected')}
            aria-current={mode === id ? 'page' : undefined}
          >
            <Icon size={17} aria-hidden="true" />
            <span>{label}</span>
            <i aria-hidden="true" />
          </button>
        ))}
      </nav>
      <span className="sr-only" role="status" aria-live="polite">{activeMode.label} selected. Collection {collectionLabels[collection]}.</span>
    </header>
  );
}
