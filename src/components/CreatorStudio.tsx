import { useEffect, useRef, useState } from 'react';
import { AudioLines, Check, FileArchive, ImagePlus, Mic, Sparkles, Square, Upload } from 'lucide-react';
import type { AgeTier, CreatorAssetBundle, StoryVariant } from '../types/story';
import { demoStory, tierStyles } from '../data/mockStories';
import { changeFrameDuration, moveFrame, retimeFrames } from '../lib/storyboard';
import { AnimatedWaveform } from './AnimatedWaveform';
import { StoryboardEditor } from './StoryboardEditor';
import { ExportModal } from './ExportModal';

export function CreatorStudio({ ageTier }: { ageTier: AgeTier }) {
  const [pitch, setPitch] = useState('A young explorer follows a golden bird to a river, where her grandmother reveals that every story is a seed. A warm, illustrated world about memory and finding your voice.');
  const [recording, setRecording] = useState(false);
  const [requestingMicrophone, setRequestingMicrophone] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioName, setAudioName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [bundle, setBundle] = useState<CreatorAssetBundle | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [draftPlaying, setDraftPlaying] = useState(false);
  const playback = useRef<HTMLAudioElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const mounted = useRef(true);
  const variant = demoStory.tierVariants[ageTier] as StoryVariant;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach(track => track.stop());
    };
  }, []);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);
  useEffect(() => { setBundle(null); setShowExport(false); setNotice(''); }, [ageTier]);
  useEffect(() => { setDraftPlaying(false); }, [audioUrl]);

  const startRecording = async () => {
    setError(null); setNotice('');
    playback.current?.pause();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('This browser cannot record audio. Upload a recording or type your pitch instead.'); return;
    }
    setRequestingMicrophone(true);
    try {
      const input = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { input.getTracks().forEach(track => track.stop()); return; }
      stream.current = input;
      const supportedType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type));
      const nextRecorder = new MediaRecorder(input, supportedType ? { mimeType: supportedType } : undefined);
      const chunks: Blob[] = [];
      nextRecorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      nextRecorder.onstop = () => {
        input.getTracks().forEach(track => track.stop());
        if (!mounted.current) return;
        const blob = new Blob(chunks, { type: nextRecorder.mimeType });
        if (blob.size) { setAudioUrl(URL.createObjectURL(blob)); setAudioName('Your recorded pitch'); }
        else setError('No audio was captured. Try recording again or upload a file.');
        setRecording(false);
      };
      nextRecorder.onerror = () => {
        input.getTracks().forEach(track => track.stop());
        if (mounted.current) { setError('Recording stopped unexpectedly. You can upload audio or use the text pitch.'); setRecording(false); }
      };
      nextRecorder.start(); recorder.current = nextRecorder; setRecording(true);
    } catch {
      stream.current?.getTracks().forEach(track => track.stop());
      if (mounted.current) setError('Microphone access was unavailable. Allow access in your browser, upload audio, or type a pitch.');
    } finally { if (mounted.current) setRequestingMicrophone(false); }
  };
  const preview = () => {
    setError(null); setNotice('');
    if (!audioUrl && pitch.trim().length < 10) { setError('Add a short pitch of at least 10 characters or attach audio.'); return; }
    const frames = retimeFrames(variant.keyframes.map(frame => ({ ...frame, prompt: `${frame.altText} Style: ${tierStyles[ageTier].theme}. Preserve character continuity and avoid embedded text.` })));
    setBundle({ id: crypto.randomUUID(), projectName: 'My story concept', ageTier, pitch: pitch.trim(), frames, status: 'preview', notificationStatus: 'not-requested' });
    setNotice('Demo storyboard ready. Sample artwork is used; your pitch has not been sent to an AI service.');
  };
  const updateFrames = (frames: CreatorAssetBundle['frames']) => {
    setBundle(current => current ? { ...current, frames, status: 'preview', notificationStatus: 'not-requested' } : null);
    setNotice('');
  };

  return <>
    <div className="page-intro"><div><span className="eyebrow text-clay">THE CREATOR'S TABLE</span><h1>Speak a world<br /><em>into possibility.</em></h1><p>Start with your voice. Leave with the beginnings of something big.</p></div><div className="intro-note"><Sparkles size={25} /><p>From a spark of an idea<br />to a world you can see.</p></div></div>
    <div className="studio-layout"><section className="studio-input panel"><div className="section-heading"><h2>Your story starts here</h2><span className="outline-badge">01 / THE PITCH</span></div><p className="helper-text">Tell us about a character, a place, or an idea you can't stop thinking about.</p>
      <div className="record-zone"><div className={recording ? 'mic-circle recording' : 'mic-circle'}><AudioLines size={34} /></div><strong>{recording ? 'Listening to your idea…' : 'A whole world, in your own words.'}</strong><p>Your recording stays in this browser session.</p><AnimatedWaveform active={recording || draftPlaying} /><button className="primary-button" disabled={requestingMicrophone} onClick={() => recording ? recorder.current?.stop() : void startRecording()}>{recording ? <Square size={15} fill="currentColor" /> : <Mic size={17} />}{recording ? 'Stop recording' : requestingMicrophone ? 'Opening microphone…' : 'Record your pitch'}</button><label className="upload-label"><Upload size={13} />or upload an audio file<input className="sr-only" type="file" accept="audio/*" disabled={recording} onChange={event => { const file = event.target.files?.[0]; if (!file) return; if ((!file.type.startsWith('audio/') && !/\.(mp3|wav|m4a|webm|ogg|mp4)$/i.test(file.name)) || file.size > 25 * 1024 * 1024) { setError('Choose an audio file up to 25 MB.'); return; } setAudioUrl(URL.createObjectURL(file)); setAudioName(file.name); setError(null); }} /></label></div>
      {audioUrl && <div className="audio-draft"><span><Check size={14} />{audioName}</span><audio ref={playback} controls src={audioUrl} onPlay={() => setDraftPlaying(true)} onPause={() => setDraftPlaying(false)} onEnded={() => setDraftPlaying(false)} onError={() => { setDraftPlaying(false); setError('This browser cannot play the selected recording. Try another format.'); }} /><button className="text-button" onClick={() => { setAudioUrl(null); setAudioName(''); }}>Remove recording</button></div>}
      <label className="field-label" htmlFor="pitch">Or put your idea into words</label><textarea id="pitch" rows={5} maxLength={5000} value={pitch} onChange={event => { setPitch(event.target.value); setBundle(null); setNotice(''); }} placeholder="Imagine a world where…" />
      <div className="studio-input-footer"><span className="helper-text">{tierStyles[ageTier].theme} · Ages {ageTier.replace('-', '–')}</span><button className="primary-button" disabled={recording || requestingMicrophone} onClick={preview}><Sparkles size={15} />Preview storyboard</button></div>
    </section><section className="studio-preview panel"><div className="section-heading"><h2>A first look at your world</h2><span className="outline-badge">02 / THE STORYBOARD</span></div><p className="helper-text">{bundle ? 'Reorder scenes, set durations, and refine each image prompt.' : 'Preview the demo storyboard to unlock scene editing.'}</p>
      {bundle ? <><label className="field-label" htmlFor="project-name">Project name</label><input className="project-name-input" id="project-name" maxLength={100} value={bundle.projectName} onChange={event => setBundle({ ...bundle, projectName: event.target.value, status: 'preview' })} /><StoryboardEditor frames={bundle.frames} onMove={(id, offset) => updateFrames(moveFrame(bundle.frames, id, offset))} onDuration={(id, seconds) => updateFrames(changeFrameDuration(bundle.frames, id, seconds))} onPrompt={(id, prompt) => updateFrames(bundle.frames.map(frame => frame.id === id ? { ...frame, prompt } : frame))} /><div className="storyboard-summary"><span>{bundle.frames.length} scenes</span><strong>{bundle.frames.at(-1)?.endTime.toFixed(1)}s edited timeline</strong></div></> : <div className="storyboard-grid">{variant.keyframes.map((frame, index) => <figure key={frame.id}><img src={frame.imageUrl} alt={frame.altText} /><figcaption><span>SCENE {String(index + 1).padStart(2, '0')}</span>{['The old tree', 'A golden guide', 'At the river', 'A new beginning'][index]}</figcaption></figure>)}</div>}
      <div className="mock-info"><ImagePlus size={18} /><p><strong>Room for your imagination.</strong> Edits are included in your export. The artwork remains sample imagery; AI regeneration and real email connect in the backend phase.</p></div>
      <button className="primary-button export-button" disabled={!bundle} onClick={() => setShowExport(true)}><FileArchive size={17} />Export & Email Asset Package</button><p className="helper-text export-helper">Inspect the JSON and ZIP payload before downloading.</p>
    </section></div>
    {error && <p className="notice error-message" role="alert">{error}</p>}{notice && <p className="notice success-message" role="status"><Check size={17} />{notice}</p>}
    {showExport && bundle && <ExportModal bundle={bundle} onClose={() => setShowExport(false)} onExported={email => { setBundle(current => current ? { ...current, status: 'exported', notificationStatus: email ? 'simulated' : 'not-requested' } : null); setNotice(email ? `Asset ZIP downloaded. Email notification to ${email} simulated; no email was sent.` : 'Asset ZIP downloaded with your edited scene order, prompts, and durations.'); }} />}
  </>;
}
