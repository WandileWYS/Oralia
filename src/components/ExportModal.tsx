import { useEffect, useRef, useState } from 'react';
import { Check, Code2, Download, FileArchive, FileJson, LoaderCircle, Mail, PackageCheck, X } from 'lucide-react';
import type { CreatorAssetBundle } from '../types/story';
import { buildManifest, packageStoryboard, type PackagedStoryboard } from '../lib/exportBundle';
import { cn } from '../lib/utils';

export function ExportModal({ bundle, onClose, onExported }: { bundle: CreatorAssetBundle; onClose: () => void; onExported: (email: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const alive = useRef(true);
  const [email, setEmail] = useState('');
  const [inspectJson, setInspectJson] = useState(false);
  const [payload, setPayload] = useState<PackagedStoryboard | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  useEffect(() => {
    alive.current = true;
    const element = dialog.current;
    // Preserve the original opener across StrictMode's effect setup/cleanup replay.
    if (!returnFocus.current && document.activeElement instanceof HTMLElement) returnFocus.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element?.showModal();
    return () => {
      alive.current = false;
      element?.close();
      document.body.style.overflow = previousOverflow;
      if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true });
    };
  }, []);
  const preview = async () => {
    setBusy(true); setError('');
    try { const result = await packageStoryboard(bundle); if (alive.current) setPayload(result); }
    catch { if (alive.current) setError('An illustration could not be packaged. Your edits are preserved. Try previewing again.'); }
    finally { if (alive.current) setBusy(false); }
  };
  const download = () => {
    if (!payload) return;
    const url = URL.createObjectURL(payload.blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'oralia-demo-storyboard.zip'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    setDownloaded(true); onExported(email);
  };
  const manifest = payload?.manifest ?? buildManifest(bundle);
  return <dialog ref={dialog} className="export-dialog" aria-labelledby="export-heading" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className="dialog-content"><div className="dialog-heading"><span className="dialog-icon"><FileArchive size={25} /></span><div><span className="eyebrow">READY FOR YOUR NEXT CHAPTER</span><h2 id="export-heading">Inspect your asset package</h2></div><button className="icon-button" aria-label="Close export inspector" disabled={busy} onClick={onClose}><X size={22} /></button></div>
      <p className="helper-text">Your edited scene order, prompts, and timings travel with your artwork. Review the payload before downloading.</p>
      <div className="payload-stats"><div><strong>{bundle.frames.length}</strong><span>illustrations</span></div><div><strong>{manifest.durationSeconds.toFixed(1)}s</strong><span>storyboard</span></div><div><strong>{bundle.ageTier.replace('-', '–')}</strong><span>age tier</span></div><div><strong>{payload ? `${(payload.blob.size / 1024).toFixed(1)} KB` : 'ZIP'}</strong><span>{payload ? 'archive size' : 'preview to build'}</span></div></div>
      <div className="inspector-tabs" role="group" aria-label="Payload inspection view"><button className={cn(!inspectJson && 'selected')} onClick={() => setInspectJson(false)} aria-pressed={!inspectJson}><FileArchive size={15} />Package structure</button><button className={cn(inspectJson && 'selected')} onClick={() => setInspectJson(true)} aria-pressed={inspectJson}><Code2 size={15} />JSON payload</button></div>
      {inspectJson ? <pre className="json-preview" tabIndex={0} aria-label="Export JSON payload">{JSON.stringify(manifest, null, 2)}</pre> : <div className="payload-structure"><div className="file-tree"><strong><FileArchive size={16} />oralia-demo-storyboard.zip</strong>{(payload?.files ?? ['manifest.json', 'storyboard.json', 'README.txt', ...manifest.frames.map(frame => frame.filename)]).map(file => <span key={file}><FileJson size={13} />{file}</span>)}</div><div className="structure-details"><h3>What’s inside</h3><dl><dt>project</dt><dd>Name, pitch, and target age tier</dd><dt>frames[]</dt><dd>Ordered assets, captions, prompts, start/end times, and duration</dd><dt>integrity</dt><dd>Image MIME types, file sizes, and SHA-256 checksums after preview</dd><dt>notification</dt><dd>Explicitly simulated; no email is sent</dd></dl></div></div>}
      <div className="payload-notice"><PackageCheck size={17} /><p>Original sample artwork. Editing prompts updates the exported instructions; it does not generate new images. Timing belongs to the storyboard, independently of the source audio.</p></div>
      {payload && <p className="success-message payload-ready" role="status"><Check size={16} />ZIP preview ready. {payload.files.length} files packaged with your current edits.</p>}
      {error && <p role="alert" className="error-message">{error}</p>}
      <form onSubmit={event => { event.preventDefault(); download(); }}><label className="field-label" htmlFor="export-email">Notification email <span>(optional simulation)</span></label><div className="email-input"><Mail size={17} /><input id="export-email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@yourstudio.com" /></div><div className="dialog-actions"><button className="secondary-button" type="button" disabled={busy || !!payload} onClick={() => void preview()}>{busy ? <LoaderCircle size={17} className="animate-spin" /> : <FileArchive size={17} />}{busy ? 'Building ZIP preview…' : payload ? 'Payload verified' : 'Preview ZIP payload'}</button><button className="primary-button" type="submit" disabled={!payload || busy}><Download size={17} />Download ZIP & simulate email</button></div></form>
      {downloaded && <p className="success-message download-success" role="status"><Check size={17} />{email ? `ZIP downloaded. Email notification to ${email} simulated; no email was sent.` : 'ZIP downloaded. Your storyboard and original sample assets are ready.'}</p>}
    </div>
  </dialog>;
}
