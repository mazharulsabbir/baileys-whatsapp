import Link from 'next/link';
import { getPlan } from '@/lib/plans';
import { getDashboardContext } from '@/lib/dashboard-session';

function formatEndsAt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function DashboardSubscriptionPage() {
  const { entitlement, hasActive } = await getDashboardContext();

  const planTitle = entitlement
    ? (getPlan(entitlement.planSlug)?.name ?? entitlement.planSlug)
    : null;
  const validUntilMs = entitlement ? new Date(entitlement.validUntil).getTime() : 0;
  const expiredByDate = !!(entitlement && validUntilMs < Date.now());
  const dateFmt = entitlement ? formatEndsAt(entitlement.validUntil) : null;

  let statusBadge: { className: string; label: string };
  let statusNote: string;

  if (hasActive && entitlement) {
    statusBadge = { className: 'sub-status-badge is-active', label: 'Active' };
    statusNote = 'Checkout and IPN have confirmed this billing window. WhatsApp pairing and APIs follow this period.';
  } else if (!entitlement) {
    statusBadge = { className: 'sub-status-badge is-none', label: 'No plan on file' };
    statusNote = 'Subscribe once via SSLCommerz — entitlement applies automatically after the gateway redirects back.';
  } else if (expiredByDate) {
    statusBadge = { className: 'sub-status-badge is-warn', label: 'Renewal needed' };
    statusNote =
      'Coverage ended after the date below. Checkout again anytime; dashboards stay read-safe until you reconnect WhatsApp.';
  } else {
    statusBadge = { className: 'sub-status-badge is-warn', label: entitlement.status };
    statusNote = 'Plan is paused or flagged in billing. Retry checkout or reach out with your SSLCommerz tran_id.';
  }

  return (
    <div className="page-shell dashboard-page">
      <header className="dashboard-page-head">
        <p className="dashboard-eyebrow">Billing</p>
        <h1>Subscription</h1>
        <p className="dashboard-lead">
          SSLCommerz charges in <strong>BDT</strong>; this page mirrors what the entitlement engine believes is true
          after IPN callbacks.
        </p>
      </header>

      <div className="subscription-layout">
        <section className="card dashboard-card subscription-primary">
          <div className="subscription-primary-top">
            <span className={statusBadge.className}>{statusBadge.label}</span>
            <h2 className="subscription-plan-title">{planTitle ?? 'Choose how you subscribe'}</h2>
            {entitlement && (
              <p className="subscription-plan-chip">{entitlement.planSlug.toUpperCase()} · SSLCommerz</p>
            )}
            <p className="subscription-plan-note">{statusNote}</p>
          </div>

          {dateFmt && entitlement && (
            <div className="subscription-renewal-block">
              <p className="subscription-renewal-label">Billing period ends</p>
              <time className="subscription-renewal-date" dateTime={entitlement.validUntil}>
                {dateFmt}
              </time>
              <p className="subscription-renewal-short">Times use your browser&apos;s locale settings.</p>
            </div>
          )}

          <div className="subscription-actions">
            <Link href="/pricing" className="button">
              View plans & renew
            </Link>
            {hasActive && (
              <Link href="/dashboard/usage" className="button button-secondary">
                See API usage
              </Link>
            )}
          </div>
        </section>

        <aside className="card dashboard-card subscription-aside">
          <h3 className="subscription-aside-title">Payments / SSLCommerz</h3>
          <ul className="subscription-aside-list">
            <li>Successful IPN activates or extends your row in the entitlement database — no coupon codes.</li>
            <li>Cancel URLs return you to pricing; tran_id receipts live in SSLCommerz’s portal.</li>
            <li>Need help? Include your tran_id when contacting support.</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
