import { useEffect, useState } from 'react';
import { AudioLines, Heart } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { CreatorStudio } from './components/CreatorStudio';
import { EducationFeed } from './components/EducationFeed';
import { VellumFeed } from './components/VellumFeed';
import { ListeningRoomModal } from './components/ListeningRoomModal';
import { CreatorProfileModal } from './components/CreatorProfileModal';
import { CreatorSignInModal } from './components/CreatorSignInModal';
import { CreatorAccessGate } from './components/CreatorAccessGate';
import { UnavailablePublicViewModal } from './components/UnavailablePublicViewModal';
import { CatalogStatusModal } from './components/CatalogStatusModal';
import { useDatabaseCatalog } from './hooks/useDatabaseCatalog';
import { CreatorSessionContext, usePersistentSession } from './hooks/useCreatorSession';
import { getPlayableStories } from './lib/catalog';
import { usePublicView } from './hooks/usePublicView';
import type { AppMode } from './types/mode';
import type { CollectionFilter } from './types/story';

export default function App() {
  const [mode, setMode] = useState<AppMode>(() => new URLSearchParams(location.search).has('export') || new URLSearchParams(location.search).has('creation') ? 'creator_studio' : 'vellum');
  const [collection, setCollectionFilter] = useState<CollectionFilter>('ALL');
  const { session, save: setSession, signOut, notice: sessionNotice } = usePersistentSession();
  const catalog = useDatabaseCatalog();
  const stories = catalog.data?.stories ?? [];
  const creators = catalog.data?.creators ?? [];
  const [authOpen, setAuthOpen] = useState(false);
  useEffect(() => { if (session) setAuthOpen(false); }, [session]);
  const publicView = usePublicView();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return localStorage.getItem('oralia-editorial-theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('oralia-editorial-theme', theme); } catch { /* Appearance remains usable without storage. */ }
  }, [theme]);
  const selectMode = (next: AppMode) => { publicView.close(); setMode(next); setAuthOpen(next === 'creator_studio' && !session); };
  const returnToVellum = () => { setAuthOpen(false); publicView.close(); setMode('vellum'); };
  const visibleMode = publicView.view && mode === 'creator_studio' ? 'vellum' : mode;
  const returnFromReader = () => { setAuthOpen(false); if (mode === 'education') publicView.close(); else returnToVellum(); };
  const requestedStory = publicView.view?.kind === 'story' ? stories.find(story => story.id === publicView.view?.key) : undefined;
  const entry = requestedStory ? getPlayableStories([requestedStory])[0] : undefined;
  const profile = publicView.view?.kind === 'creator' ? creators.find(creator => creator.username === publicView.view?.key) : undefined;
  const missingPublicRecord = publicView.view?.kind === 'creator' ? !profile : !requestedStory;
  const publicCatalogPending = !!publicView.view && missingPublicRecord && (catalog.pending || !!catalog.error);

  return <CreatorSessionContext value={session}><div className="app-shell">
    <Navbar mode={visibleMode} onModeChange={selectMode} collection={collection} onCollectionChange={setCollectionFilter} theme={theme} onThemeChange={() => setTheme(value => value === 'dark' ? 'light' : 'dark')} session={session} onCreatorAuth={() => { if (session) { void signOut(); setAuthOpen(false); returnToVellum(); } else setAuthOpen(true); }} />
    <main id="main" tabIndex={-1} className="main-content">
      {sessionNotice && <p className="notice" role="status">{sessionNotice}</p>}
      {!catalog.data && <section className="collection-empty empty-state" role="status"><h1>{catalog.error ? 'Collection unavailable' : 'Opening the story collection…'}</h1><p>{catalog.error || 'Loading stories and profiles from the local database.'}</p>{catalog.error && <button className="secondary-button" onClick={catalog.retry}>Retry database connection</button>}</section>}
      {catalog.data && catalog.error && <div className="catalog-refresh-notice" role="alert"><p>The latest collection could not load. {catalog.error}</p><button type="button" className="secondary-button" onClick={catalog.retry}>Retry collection refresh</button></div>}
      {catalog.isRefreshing && <p className="helper-text catalog-refreshing" role="status">Refreshing the collection…</p>}
      {catalog.data && visibleMode === 'vellum' && <VellumFeed stories={stories} creators={creators} collection={collection} onCollectionChange={setCollectionFilter} onCreate={() => selectMode('creator_studio')} />}
      {visibleMode === 'creator_studio' && (session ? <CreatorStudio collection={collection === 'ALL' ? 'FOLK_AND_FABLE' : collection} session={session} onPublished={catalog.retry} /> : <CreatorAccessGate onSignIn={() => setAuthOpen(true)} />)}
      {catalog.data && visibleMode === 'education' && <EducationFeed creators={creators} collection={collection} onCollectionChange={setCollectionFilter} stories={stories} />}
    </main>
    <footer className="site-footer"><span><AudioLines size={16} />oralia. <span>Every voice carries a world.</span></span><span>Built with care <Heart size={11} /> Andela × OpenAI Codex Accelerator</span></footer>
    {publicCatalogPending && publicView.view && <CatalogStatusModal resource={publicView.view.kind} pending={catalog.pending} error={catalog.error} onRetry={catalog.retry} onClose={returnToVellum} />}
    {catalog.data && !publicCatalogPending && publicView.view?.kind === 'story' && (entry ? <ListeningRoomModal key={entry.story.id} story={entry.story} presentation={entry.presentation} creator={creators.find(creator => creator.id === entry.story.creatorId)} returnLabel={mode === 'education' ? 'Back to Education' : 'Back to Vellum feed'} onClose={returnFromReader} /> : <UnavailablePublicViewModal  onClose={returnToVellum} />)}
    {catalog.data && !publicCatalogPending && publicView.view?.kind === 'creator' && (profile ? <CreatorProfileModal key={profile.id} creator={profile} stories={stories} collection={collection} onCollectionChange={setCollectionFilter} onClose={returnToVellum} /> : <UnavailablePublicViewModal  onClose={returnToVellum} />)}
    {authOpen && !publicView.view && <CreatorSignInModal onClose={() => setAuthOpen(false)} onSignIn={next => { setSession(next); catalog.retry(); setAuthOpen(false); setMode('creator_studio'); }} />}
  </div></CreatorSessionContext>;
}
