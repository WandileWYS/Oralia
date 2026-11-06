import { createContext, useContext, useEffect, useState } from 'react';
import type { CreatorSession } from '../types/creator';
import { api, persistSession, readSession } from '../lib/api';

export const CreatorSessionContext = createContext<CreatorSession | null>(null);
export const useCreatorSession = () => useContext(CreatorSessionContext);
export function usePersistentSession() {
  const [session, setSession] = useState(readSession);
  const [notice, setNotice] = useState('');
  const save = (value: CreatorSession | null) => {
    setSession(value);
    setNotice(persistSession(value) ? '' : 'Browser storage is unavailable. This session will end when the page reloads.');
  };
  useEffect(() => {
    let active = true;
    if (readSession()) api.session().then(value => { if (active) save(value); }).catch(() => { if (active) { save(null); setNotice('Sign in again to restore Creator Studio access.'); } });
    const changed = () => setSession(readSession());
    window.addEventListener('storage', changed);
    return () => { active = false; window.removeEventListener('storage', changed); };
  }, []);
  const signOut = async () => {
    try { await api.logout(); save(null); setNotice('Signed out. Your account bookmarks remain in the database.'); }
    catch { save(null); setNotice('Signed out on this device. The server session could not be revoked; it will expire automatically.'); }
  };
  return { session, save, signOut, notice };
}
