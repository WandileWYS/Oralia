import { AudioLines, Mail } from 'lucide-react';

export function CreatorAccessGate({ onSignIn }: { onSignIn: () => void }) {
  return <section className="creator-access-gate"><span className="signin-mark"><AudioLines size={30} /></span><span className="eyebrow text-clay">THE CREATOR’S TABLE</span><h1>Bring your next<br /><em>story to life.</em></h1><p>Vellum is open to every listener. Verify your email to create, review, publish, and export your own illustrated stories.</p><button type="button" className="primary-button" onClick={onSignIn}><Mail size={17} />Creator email sign in</button><small>Email verification required · Your source recordings remain private</small></section>;
}
