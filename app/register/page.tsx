'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: name || undefined }),
    });
    setPending(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'Registration failed');
      return;
    }
    window.location.href = '/login';
  }

  return (
    <div className="page-shell">
    <div className="card" style={{ maxWidth: 420, margin: '0 auto' }}>
      <h1>Register</h1>
      <form onSubmit={onSubmit} style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
        <div>
          <label htmlFor="name">Name (optional)</label>
          <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
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
          <label htmlFor="password">Password (min 8 characters)</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={pending}>
          {pending ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--muted)' }}>
        Already have an account? <Link href="/login">Login</Link>
      </p>
    </div>
    </div>
  );
}
