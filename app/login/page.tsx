'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
    setPending(false);
    if (res?.error) {
      setError('Invalid email or password');
      return;
    }
    window.location.href = '/dashboard';
  }

  return (
    <div className="page-shell">
    <div className="card" style={{ maxWidth: 420, margin: '0 auto' }}>
      <h1>Login</h1>
      <form onSubmit={onSubmit} style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--muted)' }}>
        No account? <Link href="/register">Register</Link>
      </p>
    </div>
    </div>
  );
}
