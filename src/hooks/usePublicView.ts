import { useEffect, useState } from 'react';
import { parsePublicView } from '../lib/catalog';

/** Hash links make stories/profiles shareable without a server routing dependency. */
export function usePublicView() {
  const [view, setView] = useState(() => parsePublicView(window.location.hash));
  useEffect(() => {
    const changed = () => setView(parsePublicView(window.location.hash));
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  const close = () => {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setView(null);
  };
  return { view, close };
}
