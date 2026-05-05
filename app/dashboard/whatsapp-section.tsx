'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type Props = {
  hasActive: boolean;
};

export function WhatsAppSection({ hasActive }: Props) {
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);

  const pollQr = useCallback(async () => {
    const res = await fetch('/api/whatsapp/qr', { cache: 'no-store' });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setPollError(data.error ?? 'QR unavailable');
      return;
    }
    setPollError(null);
    const data = (await res.json()) as { connected: boolean; qrDataUrl: string | null };
    setConnected(data.connected);
    setQrDataUrl(data.qrDataUrl);
  }, []);

  useEffect(() => {
    if (!hasActive) return;
    const id = window.setInterval(() => {
      void pollQr();
    }, 2500);
    void pollQr();
    return () => window.clearInterval(id);
  }, [hasActive, pollQr]);

  async function manualRefresh() {
    setRefreshing(true);
    try {
      await pollQr();
    } finally {
      setRefreshing(false);
    }
  }

  async function connect() {
    setConnecting(true);
    setPollError(null);
    try {
      const res = await fetch('/api/whatsapp/connect', { method: 'POST' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setPollError(data.error ?? 'Connect failed');
        return;
      }
      await pollQr();
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      await fetch('/api/whatsapp/disconnect', { method: 'POST' });
      setConnected(false);
      setQrDataUrl(null);
      await pollQr();
    } finally {
      setDisconnecting(false);
    }
  }

  if (!hasActive) {
    return null;
  }

  const controlsBusy = connecting || disconnecting || refreshing;

  return (
    <div className="whatsapp-shell">
      <div className="integration-toolbar card dashboard-card whatsapp-toolbar">
        <div className="integration-toolbar-text">
          <span className="integration-toolbar-label">Live socket</span>
          <strong className="integration-toolbar-title">{connected ? 'Handset linked' : 'Awaiting handset'}</strong>
          <span className="integration-toolbar-hint">
            Polling mirrors what Baileys reports — refreshes roughly every{' '}
            <code className="integration-inline-code">2.5s</code> while this route is mounted.
          </span>
        </div>
        <div className="whatsapp-toolbar-controls">
          <span className={`whatsapp-live-badge ${connected ? 'is-on' : 'is-off'}`}>
            <span className="whatsapp-live-dot" aria-hidden />
            {connected ? 'Connected' : 'Not connected'}
          </span>
          <button type="button" className="button-secondary button-sm" onClick={() => void manualRefresh()} disabled={controlsBusy}>
            {refreshing ? 'Refreshing…' : 'Refresh now'}
          </button>
        </div>
      </div>

      <nav className="integration-quicknav" aria-label="WhatsApp console">
        <a href="#whatsapp-pairing">Pairing workspace</a>
        <a href="#whatsapp-troubleshooting">Troubleshooting</a>
        <Link href="/dashboard/integration">REST &amp; webhooks</Link>
        <Link href="/dashboard/account">Account</Link>
      </nav>

      <section id="whatsapp-pairing" className="card dashboard-card whatsapp-hub-card integration-section">
        <header className="integration-section-head">
          <span className="integration-section-chip">WhatsApp Web</span>
          <h2 className="integration-section-title">Pair this tenant</h2>
          <p className="integration-section-lead">
            Generates a disposable QR PNG through Baileys. Scanning binds <strong>this browser session&apos;s tenant</strong> to your
            number — unrelated environments keep their own auth folders on disk.
          </p>
        </header>

        <ol className="whatsapp-steps">
          <li>
            <strong>Boot the bridge</strong> — <strong>Connect / refresh QR</strong> allocates the socket worker if idle.
          </li>
          <li>
            <strong>Open WhatsApp on your phone</strong> → ⋮ menu → Linked devices → Link a device.
          </li>
          <li>
            <strong>Scan the PNG</strong>; keep this tab foreground until status flips to connected.
          </li>
          <li>
            <strong>Revoke intentionally</strong> — handset unlink or <strong>Disconnect</strong> here clears sockets for this tenant.
          </li>
        </ol>

        <div className="integration-actions-split whatsapp-actions-primary">
          <button type="button" onClick={() => void connect()} disabled={controlsBusy}>
            {connecting ? 'Starting socket…' : 'Connect / refresh QR'}
          </button>
          <button type="button" className="button-secondary" onClick={() => void disconnect()} disabled={controlsBusy}>
            {disconnecting ? 'Disconnecting…' : 'Disconnect & clear tenant socket'}
          </button>
        </div>

        {pollError ? (
          <div className="integration-alert error" role="alert">
            {pollError}
          </div>
        ) : null}

        <div className="whatsapp-qr-layout">
          <div className="whatsapp-qr-column">
            <h3 className="whatsapp-qr-heading">Scanner canvas</h3>
            <div className={`whatsapp-qr-frame ${connected ? 'is-connected' : ''}`}>
              {connected ? (
                <div className="whatsapp-qr-state">
                  <div className="whatsapp-qr-state-icon" aria-hidden>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="whatsapp-qr-state-title">Session online</p>
                  <p className="whatsapp-qr-state-copy">
                    API traffic routes through Baileys for this tenant. If another browser opens the same number, WhatsApp may
                    show <strong>connected elsewhere</strong> — check{' '}
                    <Link href="/dashboard/integration">integration health</Link> if sends fail silently.
                  </p>
                </div>
              ) : qrDataUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="WhatsApp Web QR — scan from Linked devices on your phone" width={272} height={272} />
                </>
              ) : (
                <div className="whatsapp-qr-placeholder">
                  <div className="whatsapp-qr-placeholder-icon" aria-hidden>
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <rect x="3" y="3" width="7" height="7" rx="1" opacity="0.35" />
                      <rect x="14" y="3" width="7" height="7" rx="1" opacity="0.55" />
                      <rect x="3" y="14" width="7" height="7" rx="1" opacity="0.55" />
                      <rect x="14" y="14" width="11" height="7" rx="1" opacity="0.25" />
                    </svg>
                  </div>
                  <p className="whatsapp-qr-placeholder-title">{connecting ? 'Rendering QR bitmap…' : 'QR not emitted yet'}</p>
                  <p className="whatsapp-qr-placeholder-copy">
                    {connecting ? 'Hang tight — the worker is exchanging pre-keys with WhatsApp.' : 'Tap Connect once, then refresh if nothing appears.'}
                  </p>
                </div>
              )}
            </div>
          </div>
          <aside className="whatsapp-qr-column whatsapp-qr-aside">
            <h3 className="whatsapp-qr-heading">Field notes</h3>
            <ul className="whatsapp-field-list">
              <li>Primary consumer app and WhatsApp Business are both supported.</li>
              <li>Expired bitmap? Hit <strong>Connect / refresh QR</strong> — Baileys rotates pair payload quickly.</li>
              <li>
                Unlinked on the phone? Status falls back to <strong>Not connected</strong> within a couple of poll cycles.
              </li>
              <li>Need API keys after pairing? Jump to the integration tab for bearer tokens.</li>
            </ul>
          </aside>
        </div>

        <div id="whatsapp-troubleshooting" className="whatsapp-callout-muted">
          <h3 className="integration-subheading whatsapp-trouble-heading">Troubleshooting</h3>
          <ul className="whatsapp-trouble-list">
            <li>
              <strong>515 / restart loops</strong> — often corrupted creds or dual login; disconnect from this UI, delete linked device from phone, regenerate QR.
            </li>
            <li>
              <strong>Message sends return 503</strong> — socket may still be handshaking; confirm status via{' '}
              <code className="integration-inline-code">GET /api/integration/v1/status</code>.
            </li>
            <li>
              <strong>Another WhatsApp tab logged-in</strong> — multi-device contention can preempt this bridge; revoke extras.
            </li>
          </ul>
          <Link href="/dashboard/subscription" className="whatsapp-inline-link">
            Verify subscription renewal →
          </Link>
        </div>
      </section>
    </div>
  );
}
