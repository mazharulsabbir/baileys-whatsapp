import Link from 'next/link';
import { formatApiQuotaLabel, getPlan } from '@/lib/plans';
import { getDashboardContext } from '@/lib/dashboard-session';
import { prisma } from '@/lib/prisma';
import { getMonthlyQuotaStatus } from '@/lib/quota';

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

function formatPaymentWhen(d: Date) {
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function paymentStatusBadge(status: string): { className: string; label: string } {
  switch (status) {
    case 'validated':
      return { className: 'payment-status-badge is-paid', label: 'Paid' };
    case 'pending':
      return { className: 'payment-status-badge is-pending', label: 'Pending' };
    case 'failed':
      return { className: 'payment-status-badge is-failed', label: 'Failed' };
    default:
      return { className: 'payment-status-badge is-muted', label: status };
  }
}

export default async function DashboardSubscriptionPage() {
  const { entitlement, hasActive, userId } = await getDashboardContext();

  const payments = await prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });

  const quota = await getMonthlyQuotaStatus(userId);

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
    statusNote =
      'Plans include a monthly API call budget (UTC calendar month) plus a paid-through date. Renew to extend access; see usage on the API usage page.';
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

          {hasActive && entitlement && (
            <div className="subscription-quota-block">
              <p className="subscription-renewal-label">API quota (this UTC month)</p>
              <p className="subscription-quota-figures">
                {quota.unlimited ? (
                  <strong>Unlimited</strong>
                ) : (
                  <>
                    <strong>{quota.used.toLocaleString()}</strong>
                    <span className="subscription-quota-sep"> / </span>
                    <strong>{(quota.limit ?? 0).toLocaleString()}</strong>
                    <span className="subscription-quota-unit"> calls</span>
                  </>
                )}
              </p>
              <p className="subscription-plan-chip subscription-quota-plan">
                {formatApiQuotaLabel(getPlan(entitlement.planSlug)?.monthlyApiQuota ?? null)}
              </p>
              <p className="subscription-renewal-short">
                Billing month <code className="subscription-period-code">{quota.periodKey}</code> · Quota resets 1st UTC.
                Optional email alerts: <Link href="/dashboard/account">Account</Link>.
              </p>
            </div>
          )}

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
              {hasActive ? 'Renew or change plan' : 'View plans & subscribe'}
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
            <li>API quota is enforced against integration calls each UTC month; unlimited tiers skip the cap.</li>
            <li>Cancel URLs return you to pricing; official receipts remain in SSLCommerz’s portal.</li>
            <li>Need help? Include your tran_id from the history below when contacting support.</li>
          </ul>
        </aside>
      </div>

      <section className="card dashboard-card billing-history-card" aria-labelledby="billing-history-heading">
        <div className="billing-history-head">
          <h2 className="dashboard-card-head" id="billing-history-heading">
            Billing history
          </h2>
          <p className="billing-history-lead">
            Checkout attempts and confirmed payments recorded for this account (SSLCommerz <code>tran_id</code>).
          </p>
        </div>
        {payments.length === 0 ? (
          <p className="billing-history-empty">
            No payment rows yet. After you checkout, paid transactions appear here with status and reference ID.
          </p>
        ) : (
          <div className="integration-table-wrap billing-history-table-wrap">
            <table className="integration-ref-table billing-history-table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Plan</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Status</th>
                  <th scope="col">Reference</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const badge = paymentStatusBadge(p.status);
                  const plan = p.planSlug ? getPlan(p.planSlug) : null;
                  const planLabel = plan?.name ?? p.planSlug ?? '—';
                  return (
                    <tr key={p.id}>
                      <td>{formatPaymentWhen(p.createdAt)}</td>
                      <td>{planLabel}</td>
                      <td>
                        {p.amount} {p.currency}
                      </td>
                      <td>
                        <span className={badge.className}>{badge.label}</span>
                      </td>
                      <td>
                        <code className="payment-tran-id">{p.tranId}</code>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
