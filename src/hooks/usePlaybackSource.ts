import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { request } from '../lib/api';
import { createTimingTone } from '../lib/timingTone';

export function usePlaybackSource(source: string, duration: number) {
  const [url, setUrl] = useState<string>();
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(true);
  const alive = useRef(true);
  const fallbackUrl = useRef<string | undefined>(undefined);
  const generation = useRef(0);
  const running = useRef<number | null>(null);
  const fallback = useCallback(async () => {
    const attempt = generation.current;
    if (running.current === attempt || fallbackUrl.current) return;
    running.current = attempt;
    try {
      const tone = await createTimingTone(duration);
      if (!alive.current || attempt !== generation.current) { URL.revokeObjectURL(tone); return; }
      fallbackUrl.current = tone;
      setUrl(tone);
      setNotice('Spoken audio is missing. A quiet timing tone is available for scene playback; it is not narration.');
    } catch { if (alive.current && attempt === generation.current) setNotice('Audio and timing synthesis are unavailable in this browser. Read the transcript and explore scene captions.'); }
    finally { if (alive.current && attempt === generation.current) setPending(false); if (running.current === attempt) running.current = null; }
  }, [duration]);
  useEffect(() => {
    alive.current = true;
    const attempt = ++generation.current;
    const controller = new AbortController();
    setPending(true); setUrl(undefined); setNotice('');
    request(`/media-status?url=${encodeURIComponent(source)}`, z.object({ available: z.boolean() }), { signal: controller.signal }).then(result => {
      if (!alive.current || attempt !== generation.current) return;
      if (result.available) { setUrl(source); setPending(false); }
      else void fallback();
    }).catch(() => { if (alive.current && !controller.signal.aborted) void fallback(); });
    return () => { alive.current = false; generation.current++; controller.abort(); if (fallbackUrl.current) URL.revokeObjectURL(fallbackUrl.current); fallbackUrl.current = undefined; };
  }, [source, fallback]);
  return { url, notice, pending, fallback };
}
