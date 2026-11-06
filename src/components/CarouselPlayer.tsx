import { useEffect, useId, useState } from 'react';
import { ArrowLeft, ArrowRight, AudioLines, Bookmark, Check, ClosedCaption, Headphones, LoaderCircle, Pause, Play, RotateCcw } from 'lucide-react';
import type { Keyframe, Story, StoryVariant } from '../types/story';
import type { CreatorProfile } from '../types/creator';
import { useAudioCarousel } from '../hooks/useAudioCarousel';
import { cn, formatTime } from '../lib/utils';
import { CreatorByline } from './CreatorByline';
import { CaptionTranscript, captionLanguages, type CaptionLanguage } from './CaptionTranscript';
import { KeyframeTimeline } from './KeyframeTimeline';
import { SceneThumbnail } from './SceneThumbnail';
import { PlaybackWaveform } from './PlaybackWaveform';
import { VolumeControl } from './VolumeControl';
import { useStoryBookmark } from '../hooks/useStoryBookmark';

interface LoadedScene { url: string; alt: string; credit?: Keyframe['imageCredit'] }

export function CarouselPlayer({ story, variant, creator }: { story: Story; variant: StoryVariant; creator?: CreatorProfile }) {
  const [voiceType, setVoiceType] = useState<'ORIGINAL' | 'STUDIO_AI'>(story.voiceType ?? 'STUDIO_AI');
  const sourceUrl = voiceType === 'ORIGINAL' ? story.originalAudioUrl ?? '' : story.audio.url;
  const player = useAudioCarousel(variant.keyframes, sourceUrl);
  const frame = variant.keyframes[player.activeKeyframeIndex];
  const [images, setImages] = useState<{ current: LoadedScene | null; previous: LoadedScene | null }>({ current: null, previous: null });
  const [imageError, setImageError] = useState(false);
  const [captions, setCaptions] = useState(true);
  const bookmark = useStoryBookmark(story.id);
  const captionOverlayId = useId();
  const [controlFeedback, setControlFeedback] = useState('');
  const [captionLanguage, setCaptionLanguage] = useState<CaptionLanguage>('en');
  const [dialectOverlay, setDialectOverlay] = useState(false);

  useEffect(() => {
    if (!frame) return;
    let cancelled = false;
    const image = new Image();
    const load = (url: string, fallback = false) => {
      image.onload = async () => {
        try { await image.decode(); } catch { /* A loaded image remains displayable without decode support. */ }
        if (cancelled) return;
        const loaded = { url, alt: fallback ? `Scene: ${frame.title ?? story.title}` : frame.altText, credit: fallback ? undefined : frame.imageCredit };
        setImages(current => current.current?.url === url ? current : { previous: current.current, current: loaded });
        setImageError(fallback);
      };
      image.onerror = () => {
        if (cancelled) return;
        if (!fallback && frame.imageFallbackUrl) load(frame.imageFallbackUrl, true);
        else setImageError(true);
      };
      image.src = url;
    };
    load(frame.imageUrl);
    variant.keyframes.slice(player.activeKeyframeIndex + 1, player.activeKeyframeIndex + 3).forEach(next => { const preload = new Image(); preload.src = next.imageUrl; });
    return () => { cancelled = true; image.onload = null; image.onerror = null; };
  }, [frame, player.activeKeyframeIndex, variant.keyframes]);

  const finished = player.duration > 0 && player.currentTime >= player.duration;
  const playLabel = player.isPlaying ? 'Pause story' : finished ? 'Replay story' : player.currentTime > 0 ? 'Resume story' : 'Play story';
  const playbackStatus = player.isBuffering ? 'Buffering audio…' : finished ? 'Story complete. Listen again?' : player.isPlaying ? `Listening · Scene ${String(player.activeKeyframeIndex + 1).padStart(2, '0')}` : player.currentTime > 0 ? 'Paused · Your place is kept' : 'Ready when you are';
  const jumpScene = (offset: number) => {
    const next = Math.max(0, Math.min(variant.keyframes.length - 1, player.activeKeyframeIndex + offset));
    player.seek(variant.keyframes[next].startTime);
  };
  return <>
    <div className="story-layout">
      <section className={cn('player-card', player.isPlaying && !player.isBuffering && 'is-playing')} aria-label="Audio story player">
        <audio ref={player.audioRef} src={player.sourceUrl} preload="metadata" />
        <div className="story-viewport">
          {images.previous && <img className="scene-image previous-scene" src={images.previous.url} alt="" aria-hidden="true" />}
          {images.current ? <img key={images.current.url} className="scene-image active-scene" src={images.current.url} alt={images.current.alt} decoding="async" /> : <div className="image-placeholder"><AudioLines size={46} /><span>{imageError ? `Listen to ${frame?.title ?? story.title}` : `Opening ${frame?.title ?? story.title}…`}</span></div>}
          <div className="image-vignette" />
          <div className="viewport-top"><span className="glass-badge"><span className="status-dot" />ORALIA · SOURCED TALE</span><span className="glass-badge">{String(player.activeKeyframeIndex + 1).padStart(2, '0')} / {String(variant.keyframes.length).padStart(2, '0')} scenes</span></div>
          {images.current?.credit && <a className="photo-credit" href={images.current.credit.sourceUrl} target="_blank" rel="noreferrer">Photo: {images.current.credit.photographer} / Unsplash</a>}
          {!player.isPlaying && <button type="button" className="viewport-play" disabled={player.sourcePending} aria-label={playLabel} onClick={() => void player.togglePlay()}><Play size={25} fill="currentColor" /></button>}
          <div className="caption-area" id={captionOverlayId}>{captions && dialectOverlay && <span className="dialect-badge">{captionLanguages[captionLanguage]} · Adapted narration</span>}{captions && frame && <p className="read-along">{frame.caption}</p>}<span className="caption-language">ENGLISH AUDIO · {captions ? 'ADAPTATION CAPTIONS' : 'SUBTITLES OFF'}</span></div>
        </div>
        <div className="player-bottom">
          <div className="playback-row">
            <button type="button" className={cn('play-button rounded-full transition-all duration-300', player.isPlaying && !player.isBuffering && 'is-playing')} onClick={() => void player.togglePlay()} aria-label={playLabel} disabled={player.sourcePending} aria-pressed={player.isPlaying} aria-busy={player.isBuffering}>{player.isBuffering ? <LoaderCircle size={20} className="animate-spin" /> : player.isPlaying ? <Pause size={20} fill="currentColor" /> : finished ? <RotateCcw size={19} /> : <Play size={20} fill="currentColor" />}</button>
            <div className="playback-timeline"><PlaybackWaveform currentTime={player.currentTime} duration={player.duration} playing={player.isPlaying && !player.isBuffering} onSeek={player.seek} /><div className="playback-times"><span className="playback-time">{formatTime(player.currentTime)}</span><span className="playback-time">{formatTime(player.duration || story.audio.durationSeconds)}</span></div></div>
            <div className="player-toggle-controls"><button type="button" className={cn('icon-button captions-button control-pill rounded-full transition-all duration-300', captions && 'active')} onClick={() => { setCaptions(value => !value); setControlFeedback(captions ? 'Subtitles hidden. The read-along transcript is still available.' : 'Subtitles are on.'); }} aria-label="Toggle subtitles" aria-pressed={captions} aria-controls={captionOverlayId} title={captions ? 'Subtitles on' : 'Subtitles off'}><ClosedCaption size={20} /><span className="toggle-state-dot" aria-hidden="true" /></button><VolumeControl volume={player.volume} muted={player.isMuted} onVolumeChange={player.changeVolume} onToggleMute={player.toggleMute} /></div>
          </div>
          <KeyframeTimeline frames={variant.keyframes} duration={player.duration} currentTime={player.currentTime} activeIndex={player.activeKeyframeIndex} onSeek={player.seek} />
          <div className="player-footer"><span className="playback-status" role="status">{player.isPlaying && !player.isBuffering ? <span className="mini-equalizer" aria-hidden="true"><i /><i /><i /></span> : <Headphones size={13} />}{playbackStatus}</span><button type="button" onClick={() => player.seek(0)} className="text-button restart-pill rounded-full"><RotateCcw size={12} />Start again</button></div>
          {controlFeedback && <p className="control-feedback" role="status">{controlFeedback}</p>}
          {player.mediaNotice && <p className="helper-text" role="status">{player.mediaNotice}</p>}
          {player.error && <p role="alert" className="error-message">{player.error}</p>}
          {imageError && <p role="status" className="helper-text">The scene photograph could not load. Narration and its aligned transcript continue.</p>}
        </div>
        <CaptionTranscript frames={variant.keyframes} activeIndex={player.activeKeyframeIndex} language={captionLanguage} overlay={dialectOverlay} onLanguageChange={setCaptionLanguage} onOverlayChange={() => setDialectOverlay(value => !value)} onSeek={player.seek} canSeek={player.duration > 0} />
      </section>
      <aside className="story-details">
        <div className="flex items-center justify-between gap-3"><span className="eyebrow text-clay">FEATURED STORY</span><span className="outline-badge">{variant.styleLabel}</span></div>
        <h2>{story.title}</h2><p className="story-description">{story.description}</p>
        <div className="creator-line">{creator ? <CreatorByline creator={creator} /> : <strong>By {story.creator}</strong>}<span className="creator-voice-note">English adaptation · Studio narration</span></div>
        <div className="story-tags"><span>English</span><span>{formatTime(story.audio.durationSeconds)} listen</span><span>Ages {variant.ageTier.replace('-', '–')}</span></div>
        <div className="recording-mode-switch story-voice-switch" role="group" aria-label="Story narration voice"><button type="button" aria-pressed={voiceType === 'ORIGINAL'} className={cn(voiceType === 'ORIGINAL' && 'selected')} onClick={() => setVoiceType('ORIGINAL')}>Original Author Voice</button><button type="button" aria-pressed={voiceType === 'STUDIO_AI'} className={cn(voiceType === 'STUDIO_AI' && 'selected')} onClick={() => setVoiceType('STUDIO_AI')}>Studio AI Voice</button></div>
        {voiceType === 'ORIGINAL' && !story.originalAudioUrl && <p className="helper-text" role="status">No original microphone recording accompanies this adaptation. A quiet timing tone supports scene navigation. Choose Studio AI Voice for the spoken narration.</p>}
        {story.quote && <blockquote>“{story.quote}”</blockquote>}
        <div className="story-actions"><button type="button" className={cn('secondary-button bookmark-button rounded-full transition-all duration-300', bookmark.saved && 'saved')} onClick={() => void bookmark.toggleSaved()} disabled={bookmark.busy} aria-busy={bookmark.busy} aria-pressed={bookmark.saved} title={bookmark.saved ? 'Remove this saved story' : 'Save this story'}>{bookmark.saved ? <Check size={16} /> : <Bookmark size={16} />}{bookmark.saved ? 'Saved to my stories' : 'Save to my stories'}</button><div className="scene-arrows"><button type="button" className="icon-button rounded-full" aria-label="Previous scene" disabled={player.activeKeyframeIndex <= 0 || !player.duration} onClick={() => jumpScene(-1)}><ArrowLeft size={18} /></button><button type="button" className="icon-button rounded-full" aria-label="Next scene" disabled={player.activeKeyframeIndex >= variant.keyframes.length - 1 || !player.duration} onClick={() => jumpScene(1)}><ArrowRight size={18} /></button></div></div>
        {bookmark.message && <p className="bookmark-feedback" role="status">{bookmark.message}</p>}
        <p className="demo-note">Scene photographs illustrate atmosphere rather than historical events.</p>
        {story.sourceUrl && <div className="story-provenance"><a href={story.sourceUrl} target="_blank" rel="noreferrer">{story.sourceTitle}</a><p>{story.culturalNote}</p></div>}
      </aside>
    </div>
    <section className="chapter-section" aria-label="Story chapters"><div className="section-heading"><div><span className="eyebrow">ONE VOICE, A WORLD OF IMAGINATION</span><h3>Inside the story</h3></div><span className="helper-text">Select a scene to jump in <ArrowRight size={14} /></span></div><div className="chapter-grid">{variant.keyframes.map((cue, index) => <button type="button" key={cue.id} onClick={() => player.seek(cue.startTime)} disabled={!player.duration} className={cn('chapter-card transition-all duration-300 hover:scale-102 focus-visible:scale-102', player.activeKeyframeIndex === index && 'current')} aria-label={`Jump to ${cue.title ?? `Scene ${index + 1}`}`} aria-current={player.activeKeyframeIndex === index ? 'step' : undefined}><div><SceneThumbnail frame={cue} /><span>{formatTime(cue.startTime)}</span><i>{String(index + 1).padStart(2, '0')}</i></div><h4>{cue.title ?? `Scene ${index + 1}`}</h4><p>{index === player.activeKeyframeIndex ? 'Now in your story' : 'Listen to this scene'}</p></button>)}</div></section>
  </>;
}
