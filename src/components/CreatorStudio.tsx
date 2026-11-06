import { useEffect, useState } from 'react';
import { AudioLines, BrainCircuit, Check, FileArchive, ImagePlus, LoaderCircle, Mic, Sparkles, Square, Upload } from 'lucide-react';
import type { StoryCollection, CreatorAssetBundle, Story } from '../types/story';
import type { CreatorSession } from '../types/creator';
import { collectionStyles } from '../data/presentation';
import { api } from '../lib/api';
import { changeFrameDuration, moveFrame, retimeFrames } from '../lib/storyboard';
import { cn, formatTime } from '../lib/utils';
import { useStudioRecording, type RecordingMode } from '../hooks/useStudioRecording';
import { AnimatedWaveform } from './AnimatedWaveform';
import { StoryboardEditor } from './StoryboardEditor';
import { ExportModal } from './ExportModal';
import { NeuralButton } from './NeuralButton';
import { StoryboardPreviewModal } from './StoryboardPreviewModal';
import { SceneThumbnail } from './SceneThumbnail';
import { DropdownSelect } from './DropdownSelect';
import { collectionLabels, storyCollections } from '../types/story';
import { AudioDraftPlayer } from './AudioDraftPlayer';

export function CreatorStudio({ collection, stories, session, onSessionChange }: { collection: StoryCollection; stories: readonly Story[]; session: CreatorSession; onSessionChange: (session: CreatorSession) => void }) {
  const [productionCollection, setProductionCollection] = useState<StoryCollection>(collection);
  const templateStory = stories.find(story => story.collection === productionCollection && story.presentation.reviewStatus === 'approved' && story.presentation.keyframes.length) ?? null;
  const [pitch, setPitch] = useState('');
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('demo');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [bundle, setBundle] = useState<CreatorAssetBundle | null>(null);
  const [modal, setModal] = useState<'storyboard' | 'export' | null>(null);
  const [previewStage, setPreviewStage] = useState(0);
  const capture = useStudioRecording({ url: templateStory?.audio.url ?? '', name: templateStory?.title ?? 'story' });
  const presentation = templateStory?.presentation;
  const [voiceBusy, setVoiceBusy] = useState(false);
  const chooseVoice = async (voiceType: 'ORIGINAL' | 'STUDIO_AI') => {
    setVoiceBusy(true); setError('');
    try { const next = await api.voice(voiceType); onSessionChange(next); setBundle(current => current ? { ...current, voiceType } : null); setNotice(`${voiceType === 'ORIGINAL' ? 'Original Phone Mic Audio' : 'Studio AI Synthesized Voice'} preference saved.`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save voice preference.'); }
    finally { setVoiceBusy(false); }
  };
  const recording = capture.phase === 'recording';
  const requesting = capture.phase === 'requesting';
  const previewBusy = modal === 'storyboard' && previewStage < 3;

  useEffect(() => { setBundle(null); setModal(null); setNotice(''); }, [productionCollection]);
  useEffect(() => { setBundle(null); setNotice(''); }, [capture.draft]);
  useEffect(() => {
    if (modal !== 'storyboard') return;
    const timers = [
      window.setTimeout(() => setPreviewStage(1), 350),
      window.setTimeout(() => setPreviewStage(2), 700),
      window.setTimeout(() => { setPreviewStage(3); setNotice('Simulated storyboard ready. Your pitch and current scene edits are included in the JSON preview.'); }, 1100),
    ];
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [modal]);

  const ensureBundle = () => {
    setError(''); setNotice(''); capture.clearError();
    if (!presentation || !templateStory) { setError('No published storyboard is available in this collection.'); return null; }
    if (!capture.draft && pitch.trim().length < 10) {
      setError('Add a short pitch of at least 10 characters or attach audio.'); return null;
    }
    // Existing edits belong to this pitch/value and survive reopening either preview.
    if (bundle) return bundle;
    const frames = retimeFrames(presentation.keyframes.map(frame => ({
      ...frame,
      prompt: `${frame.altText} Style: ${collectionStyles[productionCollection].theme}. Preserve character continuity and avoid embedded text.`,
    })));
    const next: CreatorAssetBundle = {
      id: crypto.randomUUID(), projectName: 'My story concept', collection: productionCollection, pitch: pitch.trim(), voiceType: session.preferredVoiceType,
      source: templateStory.sourceUrl ? { title: templateStory.sourceTitle ?? templateStory.title, url: templateStory.sourceUrl, note: templateStory.culturalNote ?? '' } : undefined,
      frames, status: 'preview', notificationStatus: 'not-requested',
    };
    setBundle(next);
    return next;
  };
  const preview = () => {
    if (!ensureBundle()) return;
    capture.playback.current?.pause();
    setPreviewStage(0); setModal('storyboard');
  };
  const inspectExport = () => {
    if (!ensureBundle()) return;
    capture.playback.current?.pause();
    setModal('export');
  };
  const updateFrames = (frames: CreatorAssetBundle['frames']) => {
    setBundle(current => current ? { ...current, frames, status: 'preview', notificationStatus: 'not-requested' } : null);
    setNotice('');
  };

  return <section className="creator-studio" aria-label="Creator Studio">
    <div className="page-intro">
      <div><span className="eyebrow text-clay">THE CREATOR'S TABLE</span><h1>Speak a world<br /><em>into possibility.</em></h1><p>Start with your voice. Leave with the beginnings of something big.</p></div>
      <div className="intro-note"><Sparkles size={25} /><p>From a spark of an idea<br />to a world you can see.</p></div>
    </div>

    <div className="studio-collection-selector"><DropdownSelect label="Production collection" value={productionCollection} options={storyCollections.map(value => ({value, label: collectionLabels[value]}))} onChange={setProductionCollection} /></div>
    <div className="studio-layout">
      <section className="voice-safeguard panel" aria-label="Voice Quality Safeguard"><h2>Voice Quality Safeguard</h2><p className="helper-text">Keep your phone microphone recording or choose studio synthesis for your production plan. This selection is saved to your account; generation is a separate workflow.</p><div className="recording-mode-switch" role="group" aria-label="Narration production voice"><button type="button" disabled={voiceBusy} aria-pressed={session.preferredVoiceType === 'ORIGINAL'} className={cn(session.preferredVoiceType === 'ORIGINAL' && 'selected')} onClick={() => void chooseVoice('ORIGINAL')}>Original Phone Mic Audio</button><button type="button" disabled={voiceBusy} aria-pressed={session.preferredVoiceType === 'STUDIO_AI'} className={cn(session.preferredVoiceType === 'STUDIO_AI' && 'selected')} onClick={() => void chooseVoice('STUDIO_AI')}>Studio AI Synthesized Voice</button></div></section>
      <section className="studio-input panel">
        <div className="section-heading"><h2>Your story starts here</h2><span className="outline-badge">01 / THE PITCH</span></div>
        <p className="helper-text">Tell us about a character, a place, or an idea you can't stop thinking about.</p>
        <div className="record-zone">
          <div className="recording-mode-switch rounded-full" role="group" aria-label="Recording mode">
            <button type="button" aria-pressed={recordingMode === 'demo'} disabled={recording || requesting} className={cn(recordingMode === 'demo' && 'selected')} onClick={() => setRecordingMode('demo')}><Sparkles size={13} />Demo</button>
            <button type="button" aria-pressed={recordingMode === 'microphone'} disabled={recording || requesting} className={cn(recordingMode === 'microphone' && 'selected')} onClick={() => setRecordingMode('microphone')}><Mic size={13} />Microphone</button>
          </div>
          <div className={cn('mic-circle', recording && 'recording')}><AudioLines size={34} /></div>
          <strong>{recording ? recordingMode === 'demo' ? 'Your demo session is rolling…' : 'Listening to your idea…' : 'A whole world, in your own words.'}</strong>
          <p>{recordingMode === 'demo' ? 'Microphone-free simulation with sample audio playback.' : 'Your microphone recording stays in this browser session.'}</p>
          <div className="recording-status-row"><span className={cn('recording-status', recording && 'active')} role="status"><i />{recording ? recordingMode === 'demo' ? 'Demo recording' : 'Recording' : capture.phase === 'ready' ? 'Ready to play back' : 'Ready to record'}</span><time aria-label="Recording duration">{formatTime(capture.elapsedSeconds)}</time></div>
          <AnimatedWaveform active={recording || capture.isPlaying} />
          <button type="button" className="primary-button rounded-full transition-all duration-300" disabled={requesting} onClick={() => { setNotice(''); setError(''); if (recording) capture.stop(); else void capture.start(recordingMode); }}>
            {recording ? <Square size={15} fill="currentColor" /> : requesting ? <LoaderCircle size={17} className="animate-spin" /> : <Mic size={17} />}
            {recording ? 'Stop recording' : requesting ? 'Opening microphone…' : 'Record your pitch'}
          </button>
          <label className="upload-label rounded-full transition-all duration-300"><Upload size={13} />or upload an audio file<input className="sr-only" type="file" accept="audio/*" disabled={recording || requesting} onChange={event => { const file = event.target.files?.[0]; if (file) capture.upload(file); event.target.value = ''; }} /></label>
        </div>

        {capture.draft && <div className="audio-draft rounded-2xl">
          <span><Check size={14} />{capture.draft.name}</span>
          <AudioDraftPlayer key={capture.draft.url} audioRef={capture.playback} url={capture.draft.url} isPlaying={capture.isPlaying} onPlayingChange={capture.setIsPlaying} onError={capture.playbackError} />
          <button type="button" className="text-button remove-recording rounded-full" onClick={capture.remove}>Remove recording</button>
        </div>}
        {capture.notice && <p className="recorder-notice" role="status">{capture.notice}</p>}
        {capture.error && <p className="error-message" role="alert">{capture.error}</p>}

        <label className="field-label" htmlFor="pitch">Or put your idea into words</label>
        <textarea id="pitch" className="rounded-2xl" rows={5} maxLength={5000} value={pitch} onChange={event => { setPitch(event.target.value); setBundle(null); setNotice(''); }} placeholder="Imagine a world where…" />
        <div className="studio-input-footer">
          <span className="helper-text">{collectionStyles[productionCollection].theme} · {collectionLabels[productionCollection]}</span>
          <NeuralButton icon={<BrainCircuit size={17} />} busy={previewBusy} disabled={recording || requesting} aria-haspopup="dialog" aria-expanded={modal === 'storyboard'} onClick={preview}>{previewBusy ? 'Preparing storyboard…' : 'Preview storyboard'}</NeuralButton>
        </div>
        <p className="ai-workflow-note"><Sparkles size={12} />AI workflow simulation · assembled locally</p>
      </section>

      <section className="studio-preview panel">
        <div className="section-heading"><h2>A first look at your world</h2><span className="outline-badge">02 / THE STORYBOARD</span></div>
        <p className="helper-text">{bundle ? 'Reorder scenes, set durations, and refine each image prompt.' : `Use the database storyboard “${templateStory?.title ?? 'story'}” as your editing starting point.`}</p>
        {bundle ? <>
          <label className="field-label" htmlFor="project-name">Project name</label>
          <input className="project-name-input rounded-2xl" id="project-name" maxLength={100} value={bundle.projectName} onChange={event => setBundle({ ...bundle, projectName: event.target.value, status: 'preview' })} />
          <StoryboardEditor frames={bundle.frames} onMove={(id, offset) => updateFrames(moveFrame(bundle.frames, id, offset))} onDuration={(id, seconds) => updateFrames(changeFrameDuration(bundle.frames, id, seconds))} onPrompt={(id, prompt) => updateFrames(bundle.frames.map(frame => frame.id === id ? { ...frame, prompt } : frame))} />
          <div className="storyboard-summary"><span>{bundle.frames.length} scenes</span><strong>{bundle.frames.at(-1)?.endTime.toFixed(1)}s edited timeline</strong></div>
        </> : <div className="storyboard-grid">{(presentation?.keyframes ?? []).map((frame, index) => <figure key={frame.id}><SceneThumbnail frame={frame} alt={frame.altText} /><figcaption><span>SCENE {String(index + 1).padStart(2, '0')}</span>{frame.title}</figcaption></figure>)}</div>}
        <div className="studio-info"><ImagePlus size={18} /><p><strong>Room for your imagination.</strong> Edits are included in your JSON and export. These credited photographs come from the source storyboard; AI regeneration and real email are future integrations.</p></div>
        <NeuralButton className="export-button" icon={<FileArchive size={17} />} disabled={recording || requesting} data-active={modal === 'export'} aria-haspopup="dialog" aria-expanded={modal === 'export'} onClick={inspectExport}>Export & Email Asset Package</NeuralButton>
        <p className="helper-text export-helper">Opens your JSON payload. ZIP download works; email is simulated.</p>
      </section>
    </div>

    {error && <p className="notice error-message" role="alert">{error}</p>}
    {notice && <p className="notice success-message" role="status"><Check size={17} />{notice}</p>}
    {modal === 'storyboard' && bundle && <StoryboardPreviewModal bundle={bundle} stage={previewStage} onClose={() => setModal(null)} onExport={() => setModal('export')} />}
    {modal === 'export' && bundle && <ExportModal bundle={bundle} onClose={() => setModal(null)} onExported={email => {
      setBundle(current => current ? { ...current, status: 'exported', notificationStatus: email ? 'simulated' : 'not-requested' } : null);
      setNotice(email ? `Asset ZIP downloaded. Email notification to ${email} simulated; no email was sent.` : 'Asset ZIP downloaded with your edited scene order, prompts, and durations.');
    }} />}
  </section>;
}
