import Link from 'next/link';
import { WhatsAppSection } from '../whatsapp-section';
import { getDashboardContext } from '@/lib/dashboard-session';

export default async function DashboardWhatsAppPage() {
  const { hasActive } = await getDashboardContext();

  return (
    <div className="page-shell dashboard-page">
      <header className="dashboard-page-head">
        <p className="dashboard-eyebrow">Messaging</p>
        <h1>WhatsApp</h1>
        <p className="dashboard-lead">
          This console pairs one <strong>Baileys</strong> (WhatsApp Web) session per tenant. After you scan, outbound API
          calls and inbound webhooks use that live socket — revoke from the phone or use <strong>Disconnect</strong> here
          to wipe it.
        </p>
      </header>

      {!hasActive && (
        <div className="card dashboard-card integration-locked-banner whatsapp-locked-accent">
          <div className="integration-locked-icon" aria-hidden>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </div>
          <div>
            <h2 className="integration-locked-title">Pair WhatsApp once your plan is active</h2>
            <p className="integration-locked-copy">
              Checkout through SSLCommerz first — entitlement must be green before sockets and QR payloads are allocated
              to this tenant.
            </p>
            <Link href="/pricing" className="button button-sm">
              View plans
            </Link>
          </div>
        </div>
      )}

      <WhatsAppSection hasActive={hasActive} />
    </div>
  );
}
