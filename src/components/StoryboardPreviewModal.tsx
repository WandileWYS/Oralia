import { BrainCircuit, Check, Code2, FileArchive, LoaderCircle, X } from 'lucide-react';
import type { CreatorAssetBundle } from '../types/story';
import { buildManifest } from '../lib/exportBundle';
import { useModalDialog } from '../hooks/useModalDialog';
import { cn } from '../lib/utils';

const stages = ['Shape the narrative', 'Align the scenes', 'Prepare the payload'];

export function StoryboardPreviewModal({ bundle, stage, onClose, onExport }: { bundle: CreatorAssetBundle; stage: number; onClose: () => void; onExport: () => void }) {
  const { dialog } = useModalDialog();
  const busy = stage < stages.length;
  const payload = {
    workflow: { kind: 'storyboard-preview', status: 'assembled-locally', imageGeneration: 'not-requested' },
    ...buildManifest(bundle),
  };
  return <dialog ref={dialog} className="export-dialog studio-dialog storyboard-preview-dialog" aria-labelledby="storyboard-preview-heading" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="dialog-content"><div className="dialog-heading"><span className="dialog-icon"><BrainCircuit size={26} /></span><div><span className="eyebrow">CODEX / LLM WORKFLOW · SIMULATION</span><h2 id="storyboard-preview-heading">Your story, structured.</h2></div><button type="button" className="icon-button" aria-label="Close storyboard preview" onClick={onClose}><X size={22} /></button></div>
      <p className="helper-text">Your database storyboard and current pitch, literary collection, prompts, scene order, and timings are assembled locally. No AI provider is called.</p>
      <ol className="workflow-stages" aria-label="Simulated generation stages">{stages.map((label, index) => <li key={label} className={cn(stage === index && 'active', stage > index && 'complete')}><span>{stage > index ? <Check size={14} /> : stage === index ? <LoaderCircle size={14} className="animate-spin" /> : index + 1}</span>{label}</li>)}</ol>
      <div className="preview-payload-heading"><span><Code2 size={16} />Generated JSON preview</span><i className={cn(!busy && 'ready')}>{busy ? 'Preparing locally' : 'Ready to inspect'}</i></div>
      {busy ? <div className="payload-preparing" role="status"><BrainCircuit size={34} /><strong>{stages[stage]}…</strong><span>Local assembly · database imagery · no AI provider call</span><div className="payload-progress"><span style={{ width: `${(stage + 1) / stages.length * 100}%` }} /></div></div> : <pre className="json-preview storyboard-json" tabIndex={0} aria-label="Storyboard JSON payload">{JSON.stringify(payload, null, 2)}</pre>}
      <div className="payload-notice"><BrainCircuit size={17} /><p>The neural glow represents the planned AI workflow. This preview assembles database assets and your edits; it does not transcribe audio or regenerate photographs.</p></div>
      <div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>Back to storyboard</button><button type="button" className="primary-button" disabled={busy} onClick={onExport}><FileArchive size={17} />Continue to export</button></div>
    </div>
  </dialog>;
}
