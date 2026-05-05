'use client';

import { signOut } from 'next-auth/react';
import Link from 'next/link';

type Props = {
  email: string;
};

export function SessionCard({ email }: Props) {
  const initial = email.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="dashboard-account-stack">
      <section className="card dashboard-card dashboard-session-panel">
        <div className="dashboard-session-highlight">
          <div className="dashboard-session-avatar" aria-hidden>
            {initial}
          </div>
          <div className="dashboard-session-highlight-text">
            <p className="dashboard-session-eyebrow">Primary contact</p>
            <p className="dashboard-session-email">{email}</p>
            <p className="dashboard-session-hint">Tenant owner for pairing, API keys, and webhooks.</p>
          </div>
        </div>

        <div className="dashboard-session-grid">
          <div className="dashboard-session-tile">
            <div className="dashboard-session-tile-icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M12 16v-1M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="dashboard-session-tile-title">Browser session</h3>
            <p className="dashboard-session-tile-copy">
              JWT via NextAuth — stay signed in for up to <strong>30 days</strong>. Signing out clears this browser
              only; it does not delete your subscription or WhatsApp files on the server.
            </p>
          </div>

          <div className="dashboard-session-tile">
            <div className="dashboard-session-tile-icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </div>
            <h3 className="dashboard-session-tile-title">WhatsApp session</h3>
            <p className="dashboard-session-tile-copy">
              After you scan the QR, tenant credentials live on disk until you use <strong>Disconnect</strong> in the
              console or unlink the device from your phone.
            </p>
          </div>
        </div>

        <div className="dashboard-session-actions">
          <Link href="/pricing" className="button button-sm">
            Plans &amp; checkout
          </Link>
          <button type="button" className="button button-sm button-secondary" onClick={() => void signOut({ callbackUrl: '/' })}>
            Sign out on this browser
          </button>
        </div>
      </section>

      <aside className="card dashboard-account-aside">
        <h3 className="dashboard-account-aside-title">Shortcuts</h3>
        <ul className="dashboard-account-aside-list">
          <li>
            <Link href="/dashboard/whatsapp">Manage WhatsApp pairing</Link>
          </li>
          <li>
            <Link href="/dashboard/integration">API keys &amp; webhooks</Link>
          </li>
          <li>
            <Link href="/dashboard/subscription">Subscription &amp; renewal</Link>
          </li>
        </ul>
      </aside>
    </div>
  );
}
