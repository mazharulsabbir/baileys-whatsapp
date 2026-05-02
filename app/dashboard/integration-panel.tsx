'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CopyButton } from '@/components/copy-button';

type CredentialState =
  | {
      hasApiKey: boolean;
      apiKeyPrefix: string | null;
      webhookUrl: string | null;
      hasWebhookSecret: boolean;
      enabled: boolean;
      hasOdooGateway?: boolean;
      odooConnectorUuid?: string | null;
      odooTokenPrefix?: string | null;
      odooWebhookUrl?: string | null;
    }
  | null;

export function IntegrationPanel({ hasActive }: { hasActive: boolean }) {
  const [data, setData] = useState<CredentialState>(null);
  const [loading, setLoading] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);
  const [newOdooSecret, setNewOdooSecret] = useState<{ token: string; connectorUuid: string } | null>(null);
  const [dlqItems, setDlqItems] = useState<
    { id: string; webhookUrl: string; lastError: string | null; createdAt: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [credRes, dlqRes] = await Promise.all([
        fetch('/api/integration/credential', { cache: 'no-store' }),
        fetch('/api/integration/odoo-dlq', { cache: 'no-store' }),
      ]);
      const j = (await credRes.json()) as CredentialState & { error?: string };
      if (!credRes.ok) {
        setError(j?.error ?? 'Failed to load');
        return;
      }
      setData(j as CredentialState);
      setWebhookUrl(j.webhookUrl ?? '');

      if (dlqRes.ok) {
        const dj = (await dlqRes.json()) as {
          items?: { id: string; webhookUrl: string; lastError: string | null; createdAt: string }[];
        };
        setDlqItems(dj.items ?? []);
      } else {
        setDlqItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasActive) void load();
  }, [hasActive, load]);

  const baseUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/integration/v1`
      : '';

  const odooGatewayUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/api/gateway/v1` : '';

  const curlExample = useMemo(() => {
    const key = newApiKey ?? 'YOUR_API_KEY';
    return [
      `curl -sS -X POST "${baseUrl}/messages" \\`,
      `  -H "Authorization: Bearer ${key}" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d '{"to":"491234567890","type":"text","text":"Hello"}'`,
    ].join('\n');
  }, [baseUrl, newApiKey]);

  const odooStatusExample = useMemo(() => {
    const uuid = newOdooSecret?.connectorUuid ?? 'YOUR_ACCOUNT_ID';
    const tok = newOdooSecret?.token ?? 'YOUR_TOKEN';
    return [
      `curl -sS -X GET "${odooGatewayUrl}" \\`,
      `  -H "token: ${tok}" \\`,
      `  -H "client_id: ${uuid}" \\`,
      `  -H "action: status_get" \\`,
      `  -H "Content-Type: application/json"`,
    ].join('\n');
  }, [odooGatewayUrl, newOdooSecret]);

  async function rotateApiKey() {
    setError(null);
    const res = await fetch('/api/integration/credential', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rotateApiKey' }),
    });
    const j = (await res.json()) as { apiKey?: string; error?: string; warning?: string };
    if (!res.ok) {
      setError(j.error ?? 'Could not create API key');
      return;
    }
    if (j.apiKey) setNewApiKey(j.apiKey);
    await load();
  }

  async function provisionOdooGateway() {
    setError(null);
    const res = await fetch('/api/integration/credential', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'provisionOdooGateway' }),
    });
    const j = (await res.json()) as {
      token?: string;
      connectorUuid?: string;
      error?: string;
      warning?: string;
    };
    if (!res.ok) {
      setError(j.error ?? 'Could not provision Odoo gateway credentials');
      return;
    }
    if (j.token && j.connectorUuid) {
      setNewOdooSecret({ token: j.token, connectorUuid: j.connectorUuid });
    }
    await load();
  }

  async function saveWebhook() {
    setError(null);
    const res = await fetch('/api/integration/credential', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl: webhookUrl.trim() || null,
      }),
    });
    const j = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) {
      setError(j.error ?? 'Save failed');
      return;
    }
    await load();
  }

  async function retryOdooDlq(id: string) {
    setError(null);
    const res = await fetch('/api/integration/odoo-dlq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'retry', id }),
    });
    const j = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) {
      setError(j.error ?? 'Retry failed');
      return;
    }
    await load();
  }

  async function rotateWebhookSecret() {
    setError(null);
    const res = await fetch('/api/integration/credential', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rotateWebhookSecret: true }),
    });
    const j = (await res.json()) as { webhookSecret?: string; error?: string };
    if (!res.ok) {
      setError(j.error ?? 'Failed');
      return;
    }
    if (j.webhookSecret) setNewWebhookSecret(j.webhookSecret);
    await load();
  }

  if (!hasActive) {
    return null;
  }

  return (
    <section className="card dashboard-card integration-panel">
      <h2>API keys & integration</h2>
      <p className="dashboard-muted">
        Machine-to-machine REST API for sending WhatsApp messages from Odoo or any backend. Generate an API key, copy the
        examples below, and configure your inbound webhook URL & signing secret.
      </p>

      {error && <p className="error dashboard-gap">{error}</p>}

      <div className="integration-block">
        <h3>Endpoints</h3>
        <div className="copy-row">
          <code className="integration-code">{baseUrl}</code>
          <CopyButton text={baseUrl} label="Copy base URL" />
        </div>
        <p className="dashboard-muted tight">
          <code>POST {baseUrl}/messages</code> — send text · <code>GET {baseUrl}/status</code> — connection status
        </p>
      </div>

      <div className="integration-block">
        <h3>API key</h3>
        <p className="dashboard-muted tight">
          {loading || !data
            ? 'Loading…'
            : data.hasApiKey
              ? `Active key prefix: ${data.apiKeyPrefix ?? '(unknown)'}`
              : 'No key yet — generate one and store it securely (Odoo env or secrets manager).'}
        </p>
        {newApiKey && (
          <div className="secret-reveal">
            <div className="secret-reveal-head">
              <strong>New API key — copy now</strong>
              <CopyButton text={newApiKey} label="Copy key" />
            </div>
            <code className="integration-code block">{newApiKey}</code>
          </div>
        )}
        <button type="button" className="dashboard-gap-top" onClick={() => void rotateApiKey()} disabled={loading}>
          {data?.hasApiKey ? 'Rotate API key' : 'Generate API key'}
        </button>
      </div>

      <div className="integration-block">
        <h3>Example · curl</h3>
        <div className="copy-row start">
          <pre className="integration-pre">{curlExample}</pre>
          <CopyButton text={curlExample} label="Copy curl" />
        </div>
        {!newApiKey && (
          <p className="dashboard-muted tight">Replace YOUR_API_KEY after you generate a key, or rotate and copy again.</p>
        )}
      </div>

      <div className="integration-block">
        <h3>Odoo ChatRoom connector (gateway)</h3>
        <p className="dashboard-muted tight">
          Use these with third-party Odoo ChatRoom modules: set <strong>API Endpoint</strong> to the gateway URL,{' '}
          <strong>Account ID</strong> = connector UUID, <strong>Token</strong> = gateway token. In Odoo set{' '}
          <strong>Connect to</strong> ApiChat.io or compatible. Provision credentials first, then paste into Odoo.
        </p>
        <div className="copy-row">
          <code className="integration-code">{odooGatewayUrl}</code>
          <CopyButton text={odooGatewayUrl} label="Copy gateway URL" />
        </div>
        <p className="dashboard-muted tight">
          {loading || !data
            ? 'Loading…'
            : data.hasOdooGateway
              ? `Account ID: ${data.odooConnectorUuid ?? '—'} · token prefix: ${data.odooTokenPrefix ?? '—'}`
              : 'Not provisioned yet.'}
        </p>
        {data?.odooWebhookUrl ? (
          <p className="dashboard-muted tight">
            Last Odoo-configured webhook (from <code>config_set</code>):{' '}
            <code>{data.odooWebhookUrl}</code>
          </p>
        ) : null}
        {newOdooSecret && (
          <div className="secret-reveal">
            <div className="secret-reveal-head">
              <strong>Odoo connector — copy now</strong>
              <CopyButton
                text={`Account ID (UUID): ${newOdooSecret.connectorUuid}\nToken: ${newOdooSecret.token}`}
                label="Copy both"
              />
            </div>
            <p className="dashboard-muted tight">Account ID</p>
            <code className="integration-code block">{newOdooSecret.connectorUuid}</code>
            <p className="dashboard-muted tight">Token</p>
            <code className="integration-code block">{newOdooSecret.token}</code>
          </div>
        )}
        <button
          type="button"
          className="dashboard-gap-top"
          onClick={() => void provisionOdooGateway()}
          disabled={loading}
        >
          {data?.hasOdooGateway ? 'Rotate Odoo gateway token & UUID' : 'Provision Odoo gateway credentials'}
        </button>
        <h4 className="dashboard-gap-top">Example · status (curl)</h4>
        <div className="copy-row start">
          <pre className="integration-pre">{odooStatusExample}</pre>
          <CopyButton text={odooStatusExample} label="Copy curl" />
        </div>
        <h4 className="dashboard-gap-top">Odoo webhook delivery failures</h4>
        <p className="dashboard-muted tight">
          If POSTs to your Odoo <code>acrux_webhook</code> fail after automatic retries, they appear here. Set{' '}
          <code>NEXT_PUBLIC_APP_URL</code> to your public HTTPS origin so inbound media URLs work.
        </p>
        {dlqItems.length === 0 ? (
          <p className="dashboard-muted tight">{loading ? 'Loading…' : 'No pending failures.'}</p>
        ) : (
          <ul className="dashboard-gap-top" style={{ listStyle: 'none', padding: 0 }}>
            {dlqItems.map((row) => (
              <li key={row.id} style={{ marginBottom: '0.75rem' }}>
                <code className="integration-code">{row.id}</code>
                <span className="dashboard-muted tight">
                  {new Date(row.createdAt).toLocaleString()} — {row.lastError ?? 'error'}
                </span>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => void retryOdooDlq(row.id)}
                  disabled={loading}
                >
                  Retry
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="integration-block">
        <h3>Webhook → your server</h3>
        <p className="dashboard-muted tight">
          Incoming WhatsApp messages are POSTed to your URL with <code>X-Signature: sha256=…</code> (HMAC of the body
          with your webhook secret).
        </p>
        <label className="dashboard-label">
          Webhook URL
          <input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://your-odoo.example.com/saas_whatsapp/hook/…"
          />
        </label>
        <div className="whatsapp-actions">
          <button type="button" onClick={() => void saveWebhook()} disabled={loading}>
            Save webhook URL
          </button>
          <button type="button" className="button-secondary" onClick={() => void rotateWebhookSecret()} disabled={loading}>
            New webhook secret
          </button>
        </div>
        {newWebhookSecret && (
          <div className="secret-reveal">
            <div className="secret-reveal-head">
              <strong>New webhook secret — paste into Odoo</strong>
              <CopyButton text={newWebhookSecret} label="Copy secret" />
            </div>
            <code className="integration-code block">{newWebhookSecret}</code>
          </div>
        )}
      </div>
    </section>
  );
}
