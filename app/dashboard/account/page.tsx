import { SessionCard } from '@/components/dashboard/session-card';
import { getDashboardContext } from '@/lib/dashboard-session';

export default async function DashboardAccountPage() {
  const { email } = await getDashboardContext();

  return (
    <div className="page-shell dashboard-page">
      <header className="dashboard-page-head">
        <p className="dashboard-eyebrow">Identity</p>
        <h1>Account</h1>
        <p className="dashboard-lead">
          This workspace is keyed to one email — it drives SSLCommerz receipts, entitlement, API keys, and WhatsApp
          tenant data.
        </p>
      </header>

      <SessionCard email={email} />
    </div>
  );
}
