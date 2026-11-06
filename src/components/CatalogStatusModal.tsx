import { LoaderCircle, RefreshCw, X } from 'lucide-react';
import { useId } from 'react';
import { useModalDialog } from '../hooks/useModalDialog';

export function CatalogStatusModal({ resource, pending, error, onRetry, onClose }: { resource: 'story' | 'creator'; pending: boolean; error: string; onRetry: () => void; onClose: () => void }) {
  const { dialog } = useModalDialog();
  const id = useId();
  return <dialog ref={dialog} className="creator-signin-dialog catalog-status-dialog" aria-labelledby={id} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}><div className="creator-signin-content"><button type="button" className="icon-button signin-close" aria-label="Close collection status" onClick={onClose}><X size={20} /></button><span className="signin-mark">{pending ? <LoaderCircle size={27} className="animate-spin" /> : <RefreshCw size={27} />}</span><h2 id={id}>{pending ? `Loading ${resource === 'creator' ? 'creator profile' : 'story'}…` : 'Could not refresh the collection'}</h2><p role={pending ? 'status' : 'alert'}>{pending ? 'Your page will open when the latest collection is ready.' : error}</p>{!pending && <button type="button" className="primary-button" onClick={onRetry}><RefreshCw size={16} />Retry collection refresh</button>}<button type="button" className="secondary-button" onClick={onClose}>Back to Vellum feed</button></div></dialog>;
}
