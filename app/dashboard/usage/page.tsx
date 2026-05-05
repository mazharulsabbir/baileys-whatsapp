import { ApiUsageCard } from '@/components/dashboard/api-usage-card';
import { getDashboardContext } from '@/lib/dashboard-session';

export default async function DashboardUsagePage() {
  const { hasActive } = await getDashboardContext();

  return (
    <div className="page-shell dashboard-page">
      <header className="dashboard-page-head">
        <h1>API usage</h1>
        <p className="dashboard-lead">Traffic for your tenant integration endpoints.</p>
      </header>

      <div className="dashboard-layout">
        <ApiUsageCard enabled={hasActive} showWhenDisabled />
      </div>
    </div>
  );
}
