// Shown when the site is connected to Supabase and nobody is signed in.
import { useState } from 'react';
import { useData } from '../lib/DataContext.jsx';

export default function SignIn() {
  const { signIn } = useData();
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setState('sending');
    try {
      await signIn(email.trim());
      setState('sent');
    } catch (err) {
      setError(err.message);
      setState('error');
    }
  }

  return (
    <div className="signin">
      <div className="card signin-card">
        <span className="brand-mark" aria-hidden>N</span>
        <h1>Network Tracker</h1>
        {state === 'sent' ? (
          <>
            <p>Check <strong>{email}</strong> for a sign-in link. Open it on this device to continue.</p>
            <button className="btn btn-ghost" onClick={() => setState('idle')}>Use a different email</button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="signin-form">
            <p className="muted">Sign in with your email. We’ll send you a one-time link, so there’s no password.</p>
            <label htmlFor="signin-email" className="label-text">Email</label>
            <input
              id="signin-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            {state === 'error' && <div className="toast toast-error">{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
