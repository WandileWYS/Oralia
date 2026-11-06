import { useEffect, useRef, useState } from 'react';

export type RecordingMode = 'demo' | 'microphone';
type RecordingPhase = 'idle' | 'requesting' | 'recording' | 'ready';
interface AudioDraft { url: string; name: string }

export function useStudioRecording(sample: { url: string; name: string }) {
  const [phase, setPhase] = useState<RecordingPhase>('idle');
  const [draft, setDraft] = useState<AudioDraft | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const playback = useRef<HTMLAudioElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const activeMode = useRef<RecordingMode>('demo');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach(track => track.stop());
    };
  }, []);
  useEffect(() => () => { if (draft?.url.startsWith('blob:')) URL.revokeObjectURL(draft.url); }, [draft]);
  useEffect(() => setIsPlaying(false), [draft]);
  useEffect(() => {
    if (phase !== 'recording') return;
    const started = performance.now();
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((performance.now() - started) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [phase]);

  const start = async (mode: RecordingMode) => {
    if (phase === 'recording' || phase === 'requesting') return;
    playback.current?.pause();
    setError(''); setNotice(''); setElapsedSeconds(0);
    activeMode.current = mode;
    if (mode === 'demo') { setPhase('recording'); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Microphone recording is unavailable. Choose Demo, upload audio, or type a pitch.'); return;
    }
    setPhase('requesting');
    try {
      const input = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { input.getTracks().forEach(track => track.stop()); return; }
      stream.current = input;
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type));
      const next = new MediaRecorder(input, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      next.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      next.onstop = () => {
        input.getTracks().forEach(track => track.stop());
        if (!mounted.current) return;
        const blob = new Blob(chunks, { type: next.mimeType });
        if (blob.size) {
          setDraft({ url: URL.createObjectURL(blob), name: 'Your microphone recording' });
          setPhase('ready'); setNotice('Recording ready. Your audio stays in this browser session.');
        } else { setPhase('idle'); setError('No audio was captured. Try Demo, upload a file, or record again.'); }
      };
      next.onerror = () => {
        input.getTracks().forEach(track => track.stop());
        if (mounted.current) { setPhase('idle'); setError('Recording stopped unexpectedly. Your text pitch is preserved.'); }
      };
      next.start(); recorder.current = next; setPhase('recording');
    } catch {
      stream.current?.getTracks().forEach(track => track.stop());
      if (mounted.current) { setPhase(draft ? 'ready' : 'idle'); setError('Microphone access was unavailable. Try Demo, upload a recording, or type your pitch.'); }
    }
  };
  const stop = () => {
    if (phase !== 'recording') return;
    if (activeMode.current === 'microphone') {
      if (recorder.current?.state === 'recording') recorder.current.stop();
      return;
    }
    playback.current?.pause();
    if (playback.current) playback.current.currentTime = 0;
    setDraft({ url: sample.url, name: `Practice playback · ${sample.name}` });
    setPhase('ready');
    setNotice('Demo complete. Playback uses the sample narration; no microphone was used.');
  };
  const upload = (file: File) => {
    if (phase === 'recording' || phase === 'requesting') return;
    if ((!file.type.startsWith('audio/') && !/\.(mp3|wav|m4a|webm|ogg|mp4)$/i.test(file.name)) || file.size > 25 * 1024 * 1024) {
      setError('Choose an audio file up to 25 MB.'); return;
    }
    playback.current?.pause();
    setDraft({ url: URL.createObjectURL(file), name: file.name });
    setPhase('ready'); setError(''); setNotice('Audio attached locally. Nothing has been uploaded.');
  };
  const remove = () => {
    playback.current?.pause(); setDraft(null); setPhase('idle'); setNotice(''); setError(''); setElapsedSeconds(0);
  };
  return { phase, draft, elapsedSeconds, isPlaying, error, notice, playback, start, stop, upload, remove, setIsPlaying, clearError: () => setError(''), playbackError: () => { setIsPlaying(false); setError('This recording cannot be played in this browser. Try another format or Demo.'); } };
}
