'use client';

import { signOut } from 'next-auth/react';
import Link from 'next/link';

type Props = {
  email: string;
};

export function SessionCard({ email }: Props) {
  return (
    <section className="card dashboard-card session-card">
      <h2>Account & session</h2>
      <dl className="session-dl">
        <div>
          <dt>Signed in as</dt>
          <dd>{email}</dd>
        </div>
        <div>
          <dt>Web session</dt>
          <dd>
            JWT credentials (NextAuth). Stay signed in for up to 30 days of activity; signing out ends this browser
            session only.
          </dd>
        </div>
        <div>
          <dt>WhatsApp session</dt>
          <dd>
            Stored on disk per tenant when you scan the QR code. Use <strong>Disconnect</strong> to clear the active
            socket; pair again with a fresh QR when needed.
          </dd>
        </div>
      </dl>
      <div className="session-actions">
        <Link href="/pricing" className="button-secondary button-sm">
          Manage plan
        </Link>
        <button type="button" className="button-secondary button-sm" onClick={() => void signOut({ callbackUrl: '/' })}>
          Sign out everywhere on this browser
        </button>
      </div>
    </section>
  );
}
