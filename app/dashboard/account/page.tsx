import { SessionCard } from '@/components/dashboard/session-card';
import { UsageAlertSettings } from '@/components/dashboard/usage-alert-settings';
import { getDashboardContext } from '@/lib/dashboard-session';
import { prisma } from '@/lib/prisma';

export default async function DashboardAccountPage() {
  const { email, userId } = await getDashboardContext();

  const alertPrefs = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      usageQuotaAlertsEnabled: true,
      usageAlertAt75: true,
      usageAlertAt85: true,
      usageAlertAt95: true,
    },
  });

  const usageAlertInitial = {
    usageQuotaAlertsEnabled: alertPrefs?.usageQuotaAlertsEnabled ?? true,
    usageAlertAt75: alertPrefs?.usageAlertAt75 ?? true,
    usageAlertAt85: alertPrefs?.usageAlertAt85 ?? true,
    usageAlertAt95: alertPrefs?.usageAlertAt95 ?? true,
  };

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

      <UsageAlertSettings initial={usageAlertInitial} />
    </div>
  );
}
