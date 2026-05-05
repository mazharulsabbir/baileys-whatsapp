'use client';

import Link from 'next/link';
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

function HttpBadge({ method }: { method: 'GET' | 'POST' }) {
  return (
    <span className={`http-badge http-badge-${method.toLowerCase()}`} aria-label={`HTTP ${method}`}>
      {method}
    </span>
  );
}

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
    typeof window !== 'undefined' ? `${window.location.origin}/api/integration/v1` : '';

  const odooGatewayUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/gateway/v1` : '';

  const curlMessageExample = useMemo(() => {
    const key = newApiKey ?? 'YOUR_API_KEY';
    return [
      `curl -sS -X POST "${baseUrl}/messages" \\`,
      `  -H "Authorization: Bearer ${key}" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d '{"to":"491234567890@s.whatsapp.net","type":"text","text":"Hello"}'`,
    ].join('\n');
  }, [baseUrl, newApiKey]);

  const curlStatusExample = useMemo(() => {
    const key = newApiKey ?? 'YOUR_API_KEY';
    return [`curl -sS "${baseUrl}/status" \\`, `  -H "Authorization: Bearer ${key}"`].join('\n');
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
    const j = (await res.json()) as { apiKey?: string; error?: string };
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
    const j = (await res.json()) as { token?: string; connectorUuid?: string; error?: string };
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
      body: JSON.stringify({ webhookUrl: webhookUrl.trim() || null }),
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
    <div className="integration-shell">
      <div className="integration-toolbar card dashboard-card">
        <div className="integration-toolbar-text">
          <span className="integration-toolbar-label">Workspace</span>
          <strong className="integration-toolbar-title">Live credentials</strong>
          <span className="integration-toolbar-hint">{loading ? 'Syncing…' : 'Secrets never re-display after reload — copy when shown.'}</span>
        </div>
        <button type="button" className="button-secondary button-sm" onClick={() => void load()} disabled={loading}>
          {loading ? 'Reloading…' : 'Reload data'}
        </button>
      </div>

      {error && (
        <div className="integration-alert error" role="alert">
          {error}
        </div>
      )}

      <nav className="integration-quicknav" aria-label="On this page">
        <a href="#integration-rest">REST API</a>
        <a href="#integration-odoo">Odoo gateway</a>
        <a href="#integration-dlq">Webhook DLQ</a>
        <a href="#integration-webhooks">Inbound signing</a>
        <Link href="/dashboard/usage">Usage metrics</Link>
      </nav>

      <section id="integration-rest" className="card dashboard-card integration-section">
        <header className="integration-section-head">
          <span className="integration-section-chip">Tenant HTTP</span>
          <h2 className="integration-section-title">REST API</h2>
          <p className="integration-section-lead">
            Bearer token is your rotating API key. All routes return JSON errors with standard status codes —
            integrations should log <code className="integration-inline-code">429</code> with{' '}
            <code className="integration-inline-code">Retry-After</code> where present.
          </p>
        </header>

        <div className="integration-callout">
          <strong>Authenticate</strong>
          <p>
            <code className="integration-inline-code">Authorization: Bearer &lt;API_KEY&gt;</code>
          </p>
          <p className="integration-callout-sub">
            Equivalent for non-Bearer clients: <code className="integration-inline-code">X-Api-Key: &lt;API_KEY&gt;</code>{' '}
            (header name is case-insensitive).
          </p>
        </div>

        <div className="integration-table-wrap">
          <table className="integration-ref-table">
            <caption className="sr-only">REST endpoints</caption>
            <thead>
              <tr>
                <th scope="col">Method</th>
                <th scope="col">Path</th>
                <th scope="col">Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <HttpBadge method="POST" />
                </td>
                <td>
                  <code>/messages</code>
                </td>
                <td>
                  Send outbound text. Body uses <code className="integration-inline-code">type: &quot;text&quot;</code>;{' '}
                  <code className="integration-inline-code">to</code> accepts digits or a full WhatsApp JID.
                </td>
              </tr>
              <tr>
                <td>
                  <HttpBadge method="GET" />
                </td>
                <td>
                  <code>/status</code>
                </td>
                <td>
                  Returns <code className="integration-inline-code">connected</code>, <code className="integration-inline-code">waitingForQr</code>, and{' '}
                  <code className="integration-inline-code">tenantId</code> for dashboards and health probes.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="integration-subsection">
          <h3 className="integration-subheading">Base URL</h3>
          <div className="copy-row">
            <code className="integration-code integration-code-grow">{baseUrl}</code>
            <CopyButton text={baseUrl} label="Copy" className="button-copy" />
          </div>
        </div>

        <div className="integration-subsection">
          <h3 className="integration-subheading">API key lifecycle</h3>
          <p className="dashboard-muted tight integration-subhint">
            {loading || !data
              ? 'Loading current key fingerprint…'
              : data.hasApiKey
                ? `Active fingerprint: ${data.apiKeyPrefix ?? 'unknown prefix'} · store the full secret outside git.`
                : 'No key minted yet for this tenant.'}
          </p>
          <div className="integration-actions-inline">
            <button type="button" onClick={() => void rotateApiKey()} disabled={loading}>
              {data?.hasApiKey ? 'Rotate key' : 'Generate key'}
            </button>
          </div>
          {newApiKey && (
            <div className="secret-reveal">
              <div className="secret-reveal-head">
                <strong>New key — copy immediately</strong>
                <CopyButton text={newApiKey} label="Copy key" className="button-copy" />
              </div>
              <code className="integration-code block">{newApiKey}</code>
            </div>
          )}
        </div>

        <div className="integration-examples">
          <div className="integration-example-card">
            <div className="integration-example-head">
              <HttpBadge method="POST" />
              <span className="integration-example-title">Send message</span>
              <CopyButton text={curlMessageExample} label="Copy" className="button-copy integration-example-copy" />
            </div>
            <pre className="integration-pre integration-pre-compact">{curlMessageExample}</pre>
            {!newApiKey ? (
              <p className="integration-example-note">Swap <code className="integration-inline-code">YOUR_API_KEY</code> until you mint a secret.</p>
            ) : null}
          </div>
          <div className="integration-example-card">
            <div className="integration-example-head">
              <HttpBadge method="GET" />
              <span className="integration-example-title">Socket status</span>
              <CopyButton text={curlStatusExample} label="Copy" className="button-copy integration-example-copy" />
            </div>
            <pre className="integration-pre integration-pre-compact">{curlStatusExample}</pre>
          </div>
        </div>
      </section>

      <section id="integration-odoo" className="card dashboard-card integration-section">
        <header className="integration-section-head">
          <span className="integration-section-chip">ERP bridge</span>
          <h2 className="integration-section-title">Odoo gateway</h2>
          <p className="integration-section-lead">
            ChatRoom-compatible modules expect <strong>API Endpoint</strong> + <strong>Account ID</strong> + <strong>Token</strong> headers
            exchanged through <code className="integration-inline-code">/api/gateway/v1</code>. Provision below, paste into Odoo, then probe with the status snippet.
          </p>
        </header>

        <div className="integration-subsection">
          <h3 className="integration-subheading">Gateway origin</h3>
          <div className="copy-row">
            <code className="integration-code integration-code-grow">{odooGatewayUrl}</code>
            <CopyButton text={odooGatewayUrl} label="Copy" className="button-copy" />
          </div>
        </div>

        <div className="integration-subsection">
          <h3 className="integration-subheading">Provisioned identifiers</h3>
          <p className="dashboard-muted tight integration-subhint">
            {loading || !data
              ? 'Loading Odoo linkage…'
              : data.hasOdooGateway
                ? `Connector UUID visible to Odoo: ${data.odooConnectorUuid ?? '—'} · token prefix ${data.odooTokenPrefix ?? '—'}`
                : 'Not wired yet.'}
          </p>
          {data?.odooWebhookUrl ? (
            <p className="dashboard-muted tight">
              Last <code className="integration-inline-code">config_set</code> webhook hint:{' '}
              <code className="integration-inline-code">{data.odooWebhookUrl}</code>
            </p>
          ) : null}
          <div className="integration-actions-inline">
            <button type="button" onClick={() => void provisionOdooGateway()} disabled={loading}>
              {data?.hasOdooGateway ? 'Rotate token & connector UUID' : 'Provision gateway'}
            </button>
          </div>
          {newOdooSecret && (
            <div className="secret-reveal">
              <div className="secret-reveal-head">
                <strong>Secrets — paste into Odoo</strong>
                <CopyButton
                  text={`Account ID: ${newOdooSecret.connectorUuid}\nToken: ${newOdooSecret.token}`}
                  label="Copy pair"
                  className="button-copy"
                />
              </div>
              <p className="integration-mini-label">Account ID</p>
              <code className="integration-code block">{newOdooSecret.connectorUuid}</code>
              <p className="integration-mini-label">Token</p>
              <code className="integration-code block">{newOdooSecret.token}</code>
            </div>
          )}
        </div>

        <div className="integration-subsection">
          <h3 className="integration-subheading">Smoke test · gateway status</h3>
          <div className="integration-example-card integration-example-card-wide">
            <div className="integration-example-head">
              <span className="integration-example-title muted">curl</span>
              <CopyButton text={odooStatusExample} label="Copy" className="button-copy integration-example-copy" />
            </div>
            <pre className="integration-pre integration-pre-compact">{odooStatusExample}</pre>
          </div>
        </div>

        <div id="integration-dlq" className="integration-dlq-panel">
          <h3 className="integration-subheading">Webhook delivery backlog</h3>
          <p className="dashboard-muted tight integration-subhint">
            Failed outbound POSTs to Odoo accumulate here after automatic retries expire. Retry once the upstream URL is reachable. Set{' '}
            <code className="integration-inline-code">NEXT_PUBLIC_APP_URL</code> to a public HTTPS origin so media URLs resolve.
          </p>
          {dlqItems.length === 0 ? (
            <p className="integration-dlq-empty">{loading ? 'Scanning backlog…' : 'Queue empty — nothing to replay.'}</p>
          ) : (
            <ul className="integration-dlq-list">
              {dlqItems.map((row) => (
                <li key={row.id} className="integration-dlq-card">
                  <div className="integration-dlq-body">
                    <code className="integration-dlq-id">{row.id}</code>
                    <time className="integration-dlq-time" dateTime={row.createdAt}>
                      {new Date(row.createdAt).toLocaleString()}
                    </time>
                    <p className="integration-dlq-error">{row.lastError ?? 'Unknown transport error'}</p>
                  </div>
                  <button
                    type="button"
                    className="button-secondary button-sm integration-dlq-retry"
                    onClick={() => void retryOdooDlq(row.id)}
                    disabled={loading}
                  >
                    Retry POST
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section id="integration-webhooks" className="card dashboard-card integration-section">
        <header className="integration-section-head">
          <span className="integration-section-chip">Ingress</span>
          <h2 className="integration-section-title">Inbound webhook signing</h2>
          <p className="integration-section-lead">
            Every payload we dispatch includes <code className="integration-inline-code">X-Signature: sha256=&lt;hmac&gt;</code> computed with your rotating secret. Validate on your edge before enqueueing CRM jobs.
          </p>
        </header>

        <label className="dashboard-label integration-label-strong">
          Webhook HTTPS URL
          <input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://odoo.example.com/saas_whatsapp/hook/acrux_…"
          />
        </label>
        <div className="integration-actions-split">
          <button type="button" onClick={() => void saveWebhook()} disabled={loading}>
            Save URL
          </button>
          <button type="button" className="button-secondary" onClick={() => void rotateWebhookSecret()} disabled={loading}>
            Rotate signing secret
          </button>
        </div>

        {newWebhookSecret ? (
          <div className="secret-reveal">
            <div className="secret-reveal-head">
              <strong>New secret — paste into Odoo webhook module</strong>
              <CopyButton text={newWebhookSecret} label="Copy" className="button-copy" />
            </div>
            <code className="integration-code block">{newWebhookSecret}</code>
          </div>
        ) : null}

        <div className="integration-callout integration-callout-warn">
          <strong>Omit logging raw bodies</strong>
          <p className="integration-callout-sub">
            Prefer structured logs (event id + tenant id). Signature verification should happen before deserialization in untrusted workers.
          </p>
        </div>
      </section>
    </div>
  );
}
