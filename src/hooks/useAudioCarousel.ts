import { useCallback, useEffect, useRef, useState } from 'react';
import type { Keyframe } from '../types/story';
import { getActiveKeyframeIndex } from './timeline';

export function useAudioCarousel(keyframes: readonly Keyframe[], sourceUrl: string) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [activeKeyframeIndex, setActiveKeyframeIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
    const waiting = () => { sync(); setIsBuffering(true); stopLoop(); };
    const visibility = () => { sync(); resumeLoop(); };
    const failure = () => { setError('The audio could not be loaded. Try playing again.'); pause(); };
    const timeEvents = ['timeupdate', 'loadedmetadata', 'durationchange', 'seeking', 'seeked', 'ratechange'] as const;
    timeEvents.forEach(event => audio.addEventListener(event, sync));
    audio.addEventListener('play', play);
    audio.addEventListener('playing', play);
    audio.addEventListener('pause', pause);
    audio.addEventListener('ended', pause);
    audio.addEventListener('waiting', waiting);
    audio.addEventListener('error', failure);
    document.addEventListener('visibilitychange', visibility);
    setError(null);
    setIsBuffering(false);
    sync();
    resumeLoop();
    return () => {
      stopLoop();
      timeEvents.forEach(event => audio.removeEventListener(event, sync));
      audio.removeEventListener('play', play);
      audio.removeEventListener('playing', play);
      audio.removeEventListener('pause', pause);
      audio.removeEventListener('ended', pause);
      audio.removeEventListener('waiting', waiting);
      audio.removeEventListener('error', failure);
      document.removeEventListener('visibilitychange', visibility);
      audio.pause();
    };
  }, [keyframes, sourceUrl]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) { audio.pause(); return; }
    setError(null);
    try {
      if (audio.error) audio.load();
      await audio.play();
    } catch {
      setError('Playback could not start. Select play to try again.');
    }
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || !Number.isFinite(time)) return;
    const target = Math.min(Math.max(0, time), audio.duration);
    audio.currentTime = target;
    setCurrentTime(target);
    setActiveKeyframeIndex(getActiveKeyframeIndex(keyframes, target));
  }, [keyframes]);

  return { audioRef, activeKeyframeIndex, isPlaying, isBuffering, currentTime, duration, error, togglePlay, seek };
}
