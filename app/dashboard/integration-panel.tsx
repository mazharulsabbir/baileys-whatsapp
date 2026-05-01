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
    }
  | null;

export function IntegrationPanel({ hasActive }: { hasActive: boolean }) {
  const [data, setData] = useState<CredentialState>(null);
  const [loading, setLoading] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/integration/credential', { cache: 'no-store' });
      const j = (await res.json()) as CredentialState & { error?: string };
      if (!res.ok) {
        setError(j?.error ?? 'Failed to load');
        return;
      }
      setData(j as CredentialState);
      setWebhookUrl(j.webhookUrl ?? '');
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

  const curlExample = useMemo(() => {
    const key = newApiKey ?? 'YOUR_API_KEY';
    return [
      `curl -sS -X POST "${baseUrl}/messages" \\`,
      `  -H "Authorization: Bearer ${key}" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d '{"to":"491234567890","type":"text","text":"Hello"}'`,
    ].join('\n');
  }, [baseUrl, newApiKey]);

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
