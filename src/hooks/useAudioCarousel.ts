import { useCallback, useEffect, useRef, useState } from 'react';
import type { Keyframe } from '../types/story';
import { getActiveKeyframeIndex } from './timeline';
import { usePlaybackSource } from './usePlaybackSource';

export function useAudioCarousel(keyframes: readonly Keyframe[], sourceUrl: string) {
  const source = usePlaybackSource(sourceUrl, keyframes.at(-1)?.endTime ?? 1);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playRequest = useRef(0);
  const previousVolume = useRef(1);
  const [activeKeyframeIndex, setActiveKeyframeIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let animationFrame = 0;
    let lastIndex = -2;
    const updateFrame = () => {
      const next = getActiveKeyframeIndex(keyframes, audio.currentTime);
      if (next !== lastIndex) { lastIndex = next; setActiveKeyframeIndex(next); }
    };
    const sync = () => {
      updateFrame();
      setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      setIsPlaying(!audio.paused && !audio.ended);
    };
    const syncVolume = () => {
      setVolume(audio.volume);
      setMuted(audio.muted);
      if (audio.volume > 0) previousVolume.current = audio.volume;
    };
    const stopLoop = () => { cancelAnimationFrame(animationFrame); animationFrame = 0; };
    const tick = () => {
      updateFrame();
      animationFrame = requestAnimationFrame(tick);
    };
    const resumeLoop = () => {
      stopLoop();
      if (!audio.paused && !audio.ended && !document.hidden) animationFrame = requestAnimationFrame(tick);
    };
    const play = () => { setError(null); setIsBuffering(false); sync(); resumeLoop(); };
    const pause = () => { sync(); stopLoop(); setIsBuffering(false); };
    const waiting = () => { sync(); setIsBuffering(!audio.paused && !audio.ended); stopLoop(); };
    const visibility = () => { sync(); resumeLoop(); };
    const failure = () => { pause(); void source.fallback(); };
    const timeEvents = ['timeupdate', 'loadedmetadata', 'durationchange', 'seeking', 'seeked', 'ratechange'] as const;
    timeEvents.forEach(event => audio.addEventListener(event, sync));
    audio.addEventListener('play', play);
    audio.addEventListener('playing', play);
    audio.addEventListener('pause', pause);
    audio.addEventListener('ended', pause);
    audio.addEventListener('waiting', waiting);
    audio.addEventListener('error', failure);
    audio.addEventListener('volumechange', syncVolume);
    document.addEventListener('visibilitychange', visibility);
    setError(null);
    setIsBuffering(false);
    sync();
    syncVolume();
    resumeLoop();
    return () => {
      stopLoop();
      playRequest.current++;
      timeEvents.forEach(event => audio.removeEventListener(event, sync));
      audio.removeEventListener('play', play);
      audio.removeEventListener('playing', play);
      audio.removeEventListener('pause', pause);
      audio.removeEventListener('ended', pause);
      audio.removeEventListener('waiting', waiting);
      audio.removeEventListener('error', failure);
      audio.removeEventListener('volumechange', syncVolume);
      document.removeEventListener('visibilitychange', visibility);
      audio.pause();
    };
  }, [keyframes, source.url, source.fallback]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    const request = ++playRequest.current;
    if (!audio.paused) { audio.pause(); return; }
    setError(null);
    try {
      if (audio.error) audio.load();
      await audio.play();
    } catch (reason) {
      if (request !== playRequest.current || audio !== audioRef.current) return;
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError('Playback could not start. Select play to try again.');
    }
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || !Number.isFinite(time)) return;
    // Media clocks can quantize a fractional cue seek just before its boundary.
    // Round user seeks up to the next millisecond so selecting a scene activates it.
    const target = Math.min(Math.max(0, Math.ceil(time * 1000) / 1000), audio.duration);
    audio.currentTime = target;
    setCurrentTime(target);
    setActiveKeyframeIndex(getActiveKeyframeIndex(keyframes, target));
  }, [keyframes]);

  const changeVolume = useCallback((next: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(next)) return;
    audio.volume = Math.max(0, Math.min(1, next));
    audio.muted = audio.volume === 0;
    if (audio.volume > 0) previousVolume.current = audio.volume;
    setVolume(audio.volume);
    setMuted(audio.muted);
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.muted || audio.volume === 0) {
      if (audio.volume === 0) audio.volume = previousVolume.current || 1;
      audio.muted = false;
    } else audio.muted = true;
    setVolume(audio.volume);
    setMuted(audio.muted);
  }, []);

  return { audioRef, sourceUrl: source.url, mediaNotice: source.notice, sourcePending: source.pending, activeKeyframeIndex, isPlaying, isBuffering, currentTime, duration, error, togglePlay, seek, volume, isMuted: muted || volume === 0, changeVolume, toggleMute };
}
