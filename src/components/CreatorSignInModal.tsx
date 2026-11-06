import { useId, useState } from 'react';
import { ArrowRight, LoaderCircle, Mail, ShieldCheck, X } from 'lucide-react';
import { useModalDialog } from '../hooks/useModalDialog';
import type { CreatorSession } from '../types/creator';
import { api } from '../lib/api';

export function CreatorSignInModal({ onSignIn, onClose }: { onSignIn: (session: CreatorSession) => void; onClose: () => void }) {
  const { dialog, alive } = useModalDialog();
  const id = useId();
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [challenge, setChallenge] = useState('');
  const [phase, setPhase] = useState<'email' | 'sending' | 'pin' | 'verifying'>('email');
  const [error, setError] = useState('');
  const sending = phase === 'sending';
  const busy = sending || phase === 'verifying';
  const submit = async () => {
    setError('');
    try {
      if (phase === 'email') {
        setPhase('sending');
        const [result] = await Promise.all([api.requestPin(email), new Promise(resolve => setTimeout(resolve, 700))]);
        if (alive.current) { setChallenge(result.challengeId); setPhase('pin'); }
      } else {
        setPhase('verifying');
        const session = await api.verifyPin(challenge, pin);
        if (alive.current) onSignIn(session);
      }
    } catch (reason) {
      if (alive.current) { setError(reason instanceof Error ? reason.message : 'Could not complete sign in. Try again.'); setPhase(challenge ? 'pin' : 'email'); }
    }
  };
  return <dialog ref={dialog} className="creator-signin-dialog" aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="creator-signin-content"><button type="button" className="icon-button signin-close" aria-label="Close creator sign in" onClick={onClose}><X size={20} /></button><span className="signin-mark">{sending ? <LoaderCircle size={28} className="animate-spin" /> : challenge ? <ShieldCheck size={28} /> : <Mail size={28} />}</span><span className="eyebrow text-clay">CREATOR ACCESS · LOCAL OTP SIMULATOR</span><h2 id={`${id}-title`}>{challenge ? 'Your voice belongs here.' : 'A space for your imagination.'}</h2>
      {sending ? <p role="status">Sending 6-digit verification PIN to {email}…<br /><small>Simulated locally; no email is sent.</small></p> : <form onSubmit={event => { event.preventDefault(); void submit(); }}>
        {phase === 'email' ? <><label className="field-label" htmlFor={`${id}-email`}>Creator email</label><input id={`${id}-email`} className="signin-email" type="email" autoComplete="email" placeholder="you@yourstudio.com" required maxLength={254} autoFocus value={email} onChange={event => setEmail(event.target.value)} /></> : <><p className="helper-text">Enter any six digits for {email}. This simulator does not verify email ownership.</p><label className="field-label" htmlFor={`${id}-pin`}>6-digit verification PIN</label><input id={`${id}-pin`} key="pin" className="signin-email otp-pin" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required autoFocus value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, ''))} /><button type="button" className="text-button" disabled={busy} onClick={() => { setChallenge(''); setPin(''); setPhase('email'); setError(''); }}>Change email or request a new PIN</button></>}
        {error && <p className="error-message" role="alert">{error}</p>}
        <button type="submit" className="primary-button signin-submit" disabled={busy}>{busy ? <LoaderCircle size={17} className="animate-spin" /> : <ArrowRight size={17} />}{challenge ? 'Verify PIN & open studio' : 'Send verification PIN'}</button>
      </form>}
      <p className="signin-demo-note">Any six-digit PIN is accepted by this local authentication simulation. Sessions persist on this browser until sign-out or expiry.</p>
    </div>
  </dialog>;
}
