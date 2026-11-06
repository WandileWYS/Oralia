import { useEffect, useState } from 'react';
import { useCreatorSession } from './useCreatorSession';
import { api } from '../lib/api';

const storageKey = 'oralia-saved-stories';
function readSavedIds(): string[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]'); return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []; }
  catch { return []; }
}

/** Guest IDs stay device-local; account bookmarks are owned and stored by the database API. */
export function useStoryBookmark(storyId: string) {
  const session = useCreatorSession();
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setSaved(false); setMessage('');
    if (session) {
      setBusy(true);
      api.bookmarks().then(result => { if (active) setSaved(result.storyIds.includes(storyId)); }).catch(reason => { if (active) setMessage(reason instanceof Error ? reason.message : 'Could not read bookmarks.'); }).finally(() => { if (active) setBusy(false); });
    } else { setSaved(readSavedIds().includes(storyId)); setBusy(false); }
    const changed = () => { if (!session) setSaved(readSavedIds().includes(storyId)); };
    window.addEventListener('storage', changed);
    return () => { active = false; window.removeEventListener('storage', changed); };
  }, [storyId, session?.id]);
  const toggleSaved = async () => {
    if (busy) return;
    const next = !saved;
    setBusy(true);
    try {
      if (session) { await api.bookmark(storyId, next); setMessage(next ? 'Saved to your account stories.' : 'Removed from your account stories.'); }
      else {
        const ids = new Set(readSavedIds());
        if (next) ids.add(storyId); else ids.delete(storyId);
        localStorage.setItem(storageKey, JSON.stringify([...ids]));
        setMessage(next ? 'Saved to your stories on this device.' : 'Removed from your saved stories.');
      }
      setSaved(next);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Could not save this bookmark. Try again.'); }
    finally { setBusy(false); }
  };
  return { saved, message, busy, toggleSaved };
}
