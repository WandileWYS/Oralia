import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, AudioLines, Bookmark, Check, ClosedCaption, Headphones, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import type { Story, StoryVariant } from '../types/story';
import { useAudioCarousel } from '../hooks/useAudioCarousel';
import { cn, formatTime } from '../lib/utils';
import { chapterTitles } from '../data/mockStories';
import { CaptionTranscript, captionLanguages, type CaptionLanguage } from './CaptionTranscript';
import { KeyframeTimeline } from './KeyframeTimeline';

export function CarouselPlayer({ story, variant }: { story: Story; variant: StoryVariant }) {
  const player = useAudioCarousel(variant.keyframes, story.audio.url);
  const frame = variant.keyframes[player.activeKeyframeIndex];
  const [displayedImage, setDisplayedImage] = useState<{ url: string; alt: string } | null>(null);
  const [imageError, setImageError] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [muted, setMuted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [captionLanguage, setCaptionLanguage] = useState<CaptionLanguage>('en');
  const [dialectOverlay, setDialectOverlay] = useState(false);

  useEffect(() => {
    if (!frame) return;
    let cancelled = false;
    const image = new Image();
    image.onload = async () => {
      try { await image.decode(); } catch { /* Loaded images can still be displayed when decode is unavailable. */ }
      if (!cancelled) { setDisplayedImage({ url: frame.imageUrl, alt: frame.altText }); setImageError(false); }
    };
    image.onerror = () => { if (!cancelled) setImageError(true); };
    image.src = frame.imageUrl;
    variant.keyframes.slice(player.activeKeyframeIndex + 1, player.activeKeyframeIndex + 3).forEach(next => { const preload = new Image(); preload.src = next.imageUrl; });
    return () => { cancelled = true; image.onload = null; image.onerror = null; };
  }, [frame, player.activeKeyframeIndex, variant.keyframes]);

  const progress = player.duration ? player.currentTime / player.duration * 100 : 0;
  const jumpScene = (offset: number) => {
    const next = Math.max(0, Math.min(variant.keyframes.length - 1, player.activeKeyframeIndex + offset));
    player.seek(variant.keyframes[next].startTime);
  };
  return <>
    <div className="story-layout">
      <section className="player-card" aria-label="Audio story player">
        <audio ref={player.audioRef} src={story.audio.url} preload="metadata" muted={muted} />
        <div className="story-viewport">
          {displayedImage ? <img key={displayedImage.url} className="scene-image" src={displayedImage.url} alt={displayedImage.alt} /> : <div className="image-placeholder"><AudioLines size={46} /><span>{imageError ? 'Illustration unavailable. Audio is still available.' : 'Preparing your story…'}</span></div>}
          <div className="image-vignette" />
          <div className="viewport-top"><span className="glass-badge"><span className="status-dot" />ORALIA ORIGINAL</span><span className="glass-badge">{String(player.activeKeyframeIndex + 1).padStart(2, '0')} / {String(variant.keyframes.length).padStart(2, '0')} scenes</span></div>
          {!player.isPlaying && <button className="viewport-play" aria-label={player.currentTime ? 'Resume story' : 'Play story'} onClick={() => void player.togglePlay()}><Play size={25} fill="currentColor" /></button>}
          <div className="caption-area">{dialectOverlay && <span className="dialect-badge">{captionLanguages[captionLanguage]} {captionLanguage === 'en' ? '· Original captions' : '· Translation placeholder'}</span>}{captions && frame && <p className="read-along">{captionLanguage !== 'en' && <small className="placeholder-caption">{captionLanguages[captionLanguage]} translation pending · Original below</small>}{frame.caption}</p>}<span className="caption-language">ENGLISH AUDIO · {captionLanguage === 'en' ? 'ORIGINAL CAPTIONS' : `${captionLanguages[captionLanguage].toUpperCase()} PLACEHOLDER`}</span></div>
        </div>
        <div className="player-bottom">
          <div className="playback-row">
            <button className="play-button" onClick={() => void player.togglePlay()} aria-label={player.isPlaying ? 'Pause story' : 'Play story'}>{player.isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</button>
            <span className="playback-time">{formatTime(player.currentTime)}</span>
            <div className="waveform" aria-hidden="true">{Array.from({ length: 64 }, (_, index) => <span key={index} className={index / 64 * 100 < progress ? 'heard' : ''} style={{ height: `${18 + ((index * 31 + 17) % 65)}%` }} />)}</div>
            <span className="playback-time">{formatTime(player.duration || story.audio.durationSeconds)}</span>
            <button className={cn('icon-button captions-button', captions && 'active')} onClick={() => setCaptions(value => !value)} aria-label="Toggle subtitles" aria-pressed={captions}><ClosedCaption size={20} /></button>
            <button className="icon-button" onClick={() => setMuted(value => !value)} aria-label={muted ? 'Unmute story' : 'Mute story'} aria-pressed={muted}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
          </div>
          <KeyframeTimeline frames={variant.keyframes} duration={player.duration} currentTime={player.currentTime} activeIndex={player.activeKeyframeIndex} onSeek={player.seek} />
          <div className="player-footer"><span><Headphones size={13} />{player.isBuffering ? 'Buffering audio…' : 'Made for listening. Brought to life in images.'}</span><button onClick={() => player.seek(0)} className="text-button"><RotateCcw size={12} />Start again</button></div>
          {player.error && <p role="alert" className="error-message">{player.error}</p>}
          {imageError && <p role="status" className="helper-text">This illustration is unavailable. Keeping the previous frame while audio continues.</p>}
        </div>
        <CaptionTranscript frames={variant.keyframes} activeIndex={player.activeKeyframeIndex} language={captionLanguage} overlay={dialectOverlay} onLanguageChange={setCaptionLanguage} onOverlayChange={() => setDialectOverlay(value => !value)} onSeek={player.seek} canSeek={player.duration > 0} />
      </section>
      <aside className="story-details">
        <div className="flex items-center justify-between gap-3"><span className="eyebrow text-clay">FEATURED STORY</span><span className="outline-badge">{variant.styleLabel}</span></div>
        <h2>{story.title}</h2><p className="story-description">{story.description}</p>
        <div className="creator-line"><span className="avatar">O</span><div><strong>{story.creator}</strong><span>Original fiction · Synthetic demo voice</span></div></div>
        <div className="story-tags"><span>English</span><span>{formatTime(story.audio.durationSeconds)} listen</span><span>Ages {variant.ageTier.replace('-', '–')}</span></div>
        <blockquote>“Every story is a seed.<br />When we share it, something new can grow.”</blockquote>
        <div className="story-actions"><button className={cn('secondary-button', saved && 'saved')} onClick={() => setSaved(value => !value)} aria-pressed={saved}>{saved ? <Check size={16} /> : <Bookmark size={16} />}{saved ? 'Saved this session' : 'Save to my stories'}</button><div className="scene-arrows"><button className="icon-button" aria-label="Previous scene" disabled={player.activeKeyframeIndex <= 0 || !player.duration} onClick={() => jumpScene(-1)}><ArrowLeft size={18} /></button><button className="icon-button" aria-label="Next scene" disabled={player.activeKeyframeIndex >= variant.keyframes.length - 1 || !player.duration} onClick={() => jumpScene(1)}><ArrowRight size={18} /></button></div></div>
        <p className="demo-note">A working frontend demo with original sample art. No cultural provenance or dialect is inferred.</p>
      </aside>
    </div>
    <section className="chapter-section" aria-label="Story chapters"><div className="section-heading"><div><span className="eyebrow">ONE VOICE, A WORLD OF IMAGINATION</span><h3>Inside the story</h3></div><span className="helper-text">Select a scene to jump in <ArrowRight size={14} /></span></div><div className="chapter-grid">{variant.keyframes.map((cue, index) => <button key={cue.id} onClick={() => player.seek(cue.startTime)} disabled={!player.duration} className={cn('chapter-card', player.activeKeyframeIndex === index && 'current')} aria-label={`Jump to ${chapterTitles[index]}`}><div><img src={cue.imageUrl} alt="" loading="lazy" /><span>{formatTime(cue.startTime)}</span><i>{String(index + 1).padStart(2, '0')}</i></div><h4>{chapterTitles[index]}</h4><p>{index === player.activeKeyframeIndex ? 'Now in your story' : 'Listen to this scene'}</p></button>)}</div></section>
  </>;
}
