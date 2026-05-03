'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiUsageCard } from '@/components/dashboard/api-usage-card';
import { SessionCard } from '@/components/dashboard/session-card';
import { IntegrationPanel } from './integration-panel';

export type EntitlementSnapshot = {
  planSlug: string;
  status: string;
  validUntil: string;
};

type Props = {
  email: string;
  entitlement: EntitlementSnapshot | null;
  hasActive: boolean;
};

export function DashboardClient({ email, entitlement, hasActive }: Props) {
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
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

  return (
    <div className="page-shell dashboard-page">
      <header className="dashboard-page-head">
        <h1>Dashboard</h1>
        <p className="dashboard-lead">Manage subscription, WhatsApp pairing, API keys, and usage.</p>
      </header>

      <div className="dashboard-layout">
        <SessionCard email={email} />

        <section className="card dashboard-card">
          <h2>Subscription</h2>
          {!hasActive && (
            <p className="dashboard-gap">
              No active plan. <Link href="/pricing">Choose a plan</Link> and complete SSLCommerz checkout.
            </p>
          )}
          {entitlement && hasActive && (
            <ul className="dashboard-list">
              <li>
                Plan: <strong>{entitlement.planSlug}</strong>
              </li>
              <li>
                Valid until: <strong>{new Date(entitlement.validUntil).toLocaleString()}</strong>
              </li>
            </ul>
          )}
        </section>

        <ApiUsageCard enabled={hasActive} />

        <section className="card dashboard-card whatsapp-panel">
          <div className="dashboard-card-head">
            <h2>WhatsApp connection</h2>
            {hasActive && (
              <span className={`dash-badge ${connected ? 'dash-badge-ok' : 'dash-badge-warn'}`}>
                {connected ? 'Connected' : 'Not connected'}
              </span>
            )}
          </div>
          {!hasActive && (
            <p className="dashboard-muted">
              Connect WhatsApp after you have an active subscription.
            </p>
          )}
          {hasActive && (
            <>
              <p className="dashboard-muted">
                Open WhatsApp on your phone → Linked devices → Link a device, then scan the QR below. This creates a
                persistent session for your tenant until you disconnect or revoke from the phone. If you unlink this
                device on the phone, the dashboard switches to disconnected within a couple of seconds.
              </p>
              <div className="whatsapp-actions">
                <button type="button" onClick={() => void connect()} disabled={connecting}>
                  {connecting ? 'Starting…' : 'Connect / refresh QR'}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => void disconnect()}
                  disabled={disconnecting}
                >
                  {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                </button>
              </div>
              {pollError && <p className="error dashboard-gap">{pollError}</p>}
              <div className="qr-row">
                {qrDataUrl && !connected && (
                  <div className="qr-box">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrDataUrl} alt="WhatsApp QR code to scan with your phone" width={256} height={256} />
                  </div>
                )}
                <div className="qr-hints">
                  <h3 className="qr-hints-title">Scanning tips</h3>
                  <ul className="dashboard-list compact">
                    <li>Use the primary WhatsApp app — WhatsApp Business works too.</li>
                    <li>If the QR expires, click <strong>Connect / refresh QR</strong>.</li>
                    <li>Keep this dashboard open until you see Connected — polling updates every few seconds.</li>
                  </ul>
                </div>
              </div>
            </>
          )}
        </section>

        <IntegrationPanel hasActive={hasActive} />
      </div>
    </div>
  );
}
