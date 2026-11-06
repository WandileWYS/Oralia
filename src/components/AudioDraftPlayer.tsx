import { useEffect, useRef, useState, type RefObject } from 'react';
import { LoaderCircle, Pause, Play, RotateCcw } from 'lucide-react';
import { formatTime } from '../lib/utils';
import { VolumeControl } from './VolumeControl';

interface Props {
  audioRef: RefObject<HTMLAudioElement | null>;
  url: string;
  isPlaying: boolean;
  onPlayingChange: (playing: boolean) => void;
  onError: () => void;
}

/** Draft transport uses the recording hook's audio element; no independent clock. */
export function AudioDraftPlayer({ audioRef, url, isPlaying, onPlayingChange, onError }: Props) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [playPending, setPlayPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const previousVolume = useRef(1);
  const playRequest = useRef(0);
  useEffect(() => {
    const audio = audioRef.current;
    return () => { playRequest.current++; audio?.pause(); };
  }, [audioRef]);

  const sync = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
    if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
    // Some recorder containers expose Infinity until their first complete playback.
    else if (audio.ended && audio.currentTime > 0) setDuration(audio.currentTime);
    onPlayingChange(!audio.paused && !audio.ended);
  };
  const syncVolume = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setVolume(audio.volume); setMuted(audio.muted || audio.volume === 0);
    if (audio.volume > 0) previousVolume.current = audio.volume;
  };
  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    const attempt = ++playRequest.current;
    if (!audio.paused || playPending) { audio.pause(); setPlayPending(false); setBuffering(false); return; }
    setPlayPending(true); setFailed(false);
    try {
      if (audio.error) audio.load();
      if (audio.ended) audio.currentTime = 0;
      await audio.play();
    } catch (error) {
      if (attempt !== playRequest.current || audio !== audioRef.current) return;
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setFailed(true); onError();
    } finally { if (attempt === playRequest.current) setPlayPending(false); }
  };
  const seek = (seconds: number) => {
    const audio = audioRef.current;
    if (audio && duration > 0 && Number.isFinite(seconds)) {
      audio.currentTime = Math.max(0, Math.min(duration, seconds)); sync();
    }
  };
  const changeVolume = (next: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(next)) return;
    audio.volume = Math.max(0, Math.min(1, next)); audio.muted = next === 0; syncVolume();
  };
  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.volume === 0) { audio.volume = previousVolume.current; audio.muted = false; }
    else audio.muted = !audio.muted;
    syncVolume();
  };
  const finished = duration > 0 && currentTime >= duration;
  const playLabel = isPlaying || playPending ? 'Pause pitch' : finished ? 'Replay pitch' : 'Play pitch';
  const percentage = duration > 0 ? Math.min(100, currentTime / duration * 100) : 0;
  return <div className="draft-player" role="group" aria-label="Pitch playback controls">
    <audio ref={audioRef} src={url} preload="metadata" onLoadedMetadata={() => { setReady(true); setFailed(false); sync(); syncVolume(); }} onDurationChange={sync} onTimeUpdate={sync} onSeeked={sync} onVolumeChange={syncVolume} onPlay={sync} onPlaying={() => { setBuffering(false); setFailed(false); sync(); }} onPause={() => { setBuffering(false); sync(); }} onEnded={() => { setBuffering(false); sync(); }} onWaiting={() => setBuffering(true)} onError={() => { setReady(true); setFailed(true); setBuffering(false); onError(); }} />
    <div className="draft-transport"><button type="button" className="play-button" disabled={!ready} aria-label={playLabel} aria-pressed={isPlaying} aria-busy={buffering || playPending} onClick={() => void togglePlay()}>{buffering || playPending ? <LoaderCircle size={17} className="animate-spin" /> : isPlaying ? <Pause size={17} fill="currentColor" /> : finished ? <RotateCcw size={17} /> : <Play size={17} fill="currentColor" />}</button>
      <div className="draft-timeline"><input aria-label="Pitch progress" aria-valuetext={`${formatTime(currentTime)} of ${duration > 0 ? formatTime(duration) : 'unknown duration'}`} type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} disabled={!duration || failed} onChange={event => seek(Number(event.target.value))} style={{ background: `linear-gradient(to right, var(--accent) ${percentage}%, var(--border) ${percentage}%)` }} /><div className="playback-times"><time>{formatTime(currentTime)}</time><time>{duration > 0 ? formatTime(duration) : '--:--'}</time></div></div>
      <VolumeControl subject="pitch" volume={volume} muted={muted} onVolumeChange={changeVolume} onToggleMute={toggleMute} />
    </div>
    <p className="draft-playback-status" role="status">{failed ? 'Audio could not play. Try another recording or format.' : !ready ? 'Preparing your recording…' : buffering ? 'Loading audio…' : isPlaying ? 'Playing your pitch' : finished ? 'Pitch complete' : duration > 0 ? 'Ready to listen' : 'Ready to listen · Duration available after playback'}</p>
  </div>;
}
