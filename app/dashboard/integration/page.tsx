import Link from 'next/link';
import { IntegrationPanel } from '../integration-panel';
import { getDashboardContext } from '@/lib/dashboard-session';

export default async function DashboardIntegrationPage() {
  const { hasActive } = await getDashboardContext();

  return (
    <div className="page-shell dashboard-page">
      <header className="dashboard-page-head">
        <p className="dashboard-eyebrow">Developers</p>
        <h1>Integration</h1>
        <p className="dashboard-lead">
          Authenticate outbound calls with tenant API keys; verify inbound webhooks with{' '}
          <code className="integration-inline-code">HMAC-SHA256</code>. Responses are JSON — treat{' '}
          <code className="integration-inline-code">401</code> / <code className="integration-inline-code">403</code>{' '}
          as entitlement or key issues before retrying with backoff.
        </p>
      </header>

      {!hasActive && (
        <div className="card dashboard-card integration-locked-banner">
          <div className="integration-locked-icon" aria-hidden>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h2 className="integration-locked-title">API &amp; webhooks unlock with an active plan</h2>
            <p className="integration-locked-copy">
              Keys, signing secrets, and live examples appear here once SSLCommerz marks your entitlement active.
            </p>
            <Link href="/pricing" className="button button-sm">
              View plans
            </Link>
          </div>
        </div>
      )}

      <IntegrationPanel hasActive={hasActive} />
    </div>
  );
}
