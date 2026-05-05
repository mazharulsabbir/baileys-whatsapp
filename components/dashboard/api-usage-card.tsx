'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type UsageSummary = {
  totals: { last24h: number; last7d: number; last30d: number };
  byDay: { day: string; messages: number; status: number }[];
  quota: {
    unlimited: boolean;
    limit: number | null;
    used: number;
    periodKey: string;
  };
};

export function ApiUsageCard({
  enabled,
  showWhenDisabled = false,
}: {
  enabled: boolean;
  /** When true, show an empty-state card if there is no active plan instead of rendering nothing. */
  showWhenDisabled?: boolean;
}) {
  const [data, setData] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dashboard/usage', { cache: 'no-store' });
      const j = (await res.json()) as UsageSummary & { error?: string };
      if (!res.ok) {
        setError(j.error ?? 'Could not load usage');
        return;
      }
      setData(j as UsageSummary);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  if (!enabled) {
    if (!showWhenDisabled) return null;
    return (
      <section className="card dashboard-card">
        <h2>API usage</h2>
        <p className="dashboard-muted" style={{ margin: 0 }}>
          Subscribe to a plan to record and display API request metrics. <Link href="/pricing">View plans</Link>.
        </p>
      </section>
    );
  }

  const maxBar =
    data?.byDay.reduce((m, d) => Math.max(m, d.messages + d.status), 0) ?? 0;

  return (
    <section className="card dashboard-card">
      <div className="dashboard-card-head">
        <h2>API usage</h2>
        <button type="button" className="button-secondary button-sm" onClick={() => void load()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <p className="dashboard-muted">
        Counts successful integration API calls (messages + status) and applies your plan&apos;s monthly quota in{' '}
        <strong>UTC</strong>.
      </p>

      {error && <p className="error dashboard-gap">{error}</p>}

      {data && (
        <>
          {!data.quota.unlimited && data.quota.limit != null && (
            <div className="usage-quota-meter">
              <div className="usage-quota-meter-head">
                <span className="usage-quota-meter-label">
                  This UTC month ({data.quota.periodKey}) — plan quota
                </span>
                <span className="usage-quota-meter-value">
                  {data.quota.used.toLocaleString()} / {data.quota.limit.toLocaleString()} calls
                </span>
              </div>
              <div
                className="usage-quota-meter-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={data.quota.limit}
                aria-valuenow={Math.min(data.quota.used, data.quota.limit)}
                aria-label={`API quota ${data.quota.used} of ${data.quota.limit}`}
              >
                <div
                  className="usage-quota-meter-fill"
                  style={{
                    width: `${Math.min(100, Math.round((data.quota.used / data.quota.limit) * 100))}%`,
                  }}
                />
              </div>
              <p className="dashboard-muted usage-quota-meter-hint">
                Need more headroom? <Link href="/pricing">Upgrade on pricing</Link>. Optional emails at 75% · 85% · 95%
                in <Link href="/dashboard/account">Account</Link>.
              </p>
            </div>
          )}
          {data.quota.unlimited && (
            <p className="dashboard-muted usage-quota-meter-hint">
              Your plan has <strong>no monthly API cap</strong> (fair use still applies). Billing month{' '}
              {data.quota.periodKey} UTC.
            </p>
          )}

          <div className="usage-stat-grid">
            <div className="usage-stat">
              <span className="usage-stat-label">Last 24 hours</span>
              <span className="usage-stat-value">{data.totals.last24h}</span>
            </div>
            <div className="usage-stat">
              <span className="usage-stat-label">Last 7 days</span>
              <span className="usage-stat-value">{data.totals.last7d}</span>
            </div>
            <div className="usage-stat">
              <span className="usage-stat-label">Last 30 days</span>
              <span className="usage-stat-value">{data.totals.last30d}</span>
            </div>
          </div>

          <h3 className="usage-chart-title">Last 14 days (UTC)</h3>
          <div className="usage-chart" role="img" aria-label="API requests per day">
            {data.byDay.map((row) => {
              const total = row.messages + row.status;
              const h = maxBar > 0 ? Math.max(8, Math.round((total / maxBar) * 100)) : 0;
              return (
                <div key={row.day} className="usage-bar-wrap">
                  <div className="usage-bar-track" title={`${row.day}: ${total} requests`}>
                    <div className="usage-bar-fill" style={{ height: `${h}%` }} />
                  </div>
                  <span className="usage-bar-label">{row.day.slice(5)}</span>
                </div>
              );
            })}
          </div>
          <p className="dashboard-muted usage-legend">
            Bar height is total requests that day (messages + status checks).
          </p>
        </>
      )}

      {!data && !error && loading && <p className="dashboard-muted">Loading usage…</p>}
    </section>
  );
}
