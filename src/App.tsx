import { useEffect, useState } from 'react';
import { ArrowUpRight, AudioLines, Heart, Leaf } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { CarouselPlayer } from './components/CarouselPlayer';
import { CreatorStudio } from './components/CreatorStudio';
import { EducationFeed } from './components/EducationFeed';
import { demoStory } from './data/mockStories';
import type { AppMode } from './types/mode';
import type { AgeTier } from './types/story';

export default function App() {
  const [mode, setMode] = useState<AppMode>('social_reel');
  const [ageTier, setAgeTier] = useState<AgeTier>('10-13');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return localStorage.getItem('oralia-theme') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('oralia-theme', theme); } catch { /* Theme remains usable when storage is unavailable. */ }
  }, [theme]);
  const variant = demoStory.tierVariants[ageTier];
  return <div className="app-shell">
    <Navbar mode={mode} onModeChange={setMode} ageTier={ageTier} onAgeTierChange={setAgeTier} theme={theme} onThemeChange={() => setTheme(value => value === 'dark' ? 'light' : 'dark')} />
    <main id="main" tabIndex={-1} className="main-content">
      {mode === 'social_reel' && <>
        <div className="page-intro"><div><span className="eyebrow text-clay"><span className="tiny-line" />STORIES LIVE IN OUR VOICES</span><h1>Made to be heard.<br /><em>Imagined to be seen.</em></h1><p>Discover a world of stories. One voice, one moment at a time.</p></div><div className="intro-note"><Leaf size={25} strokeWidth={1.3} /><p>Rooted in oral tradition.<br />Reimagined for a new generation.</p></div></div>
        <div className="feed-heading"><span><span className="status-dot" />THE LISTENING ROOM</span><span>Take a moment. Let a story find you. <ArrowUpRight size={14} /></span></div>
        {variant && <CarouselPlayer key={`${demoStory.id}-${ageTier}`} story={demoStory} variant={variant} />}
        <div className="invitation"><div className="invitation-icon"><MicMark /></div><div><h3>Your voice belongs here.</h3><p>A memory. A folktale. A world only you can imagine. Let's hear it.</p></div><button className="secondary-button" onClick={() => setMode('creator_studio')}>Tell your story <ArrowUpRight size={16} /></button></div>
      </>}
      {mode === 'creator_studio' && <CreatorStudio ageTier={ageTier} />}
      {mode === 'education' && <EducationFeed ageTier={ageTier} onAgeTierChange={setAgeTier} story={demoStory} />}
    </main>
    <footer className="site-footer"><span><AudioLines size={16} />oralia. <span>Every voice carries a world.</span></span><span>Built with care <Heart size={11} /> Andela × OpenAI Codex Accelerator</span></footer>
  </div>;
}
function MicMark() { return <AudioLines size={26} strokeWidth={1.5} />; }
