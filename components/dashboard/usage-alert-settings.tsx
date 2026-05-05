'use client';

import { useCallback, useState } from 'react';

export type UsageAlertPrefs = {
  usageQuotaAlertsEnabled: boolean;
  usageAlertAt75: boolean;
  usageAlertAt85: boolean;
  usageAlertAt95: boolean;
};

export function UsageAlertSettings({ initial }: { initial: UsageAlertPrefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const patch = useCallback(
    async (next: Partial<UsageAlertPrefs>) => {
      setSaving(true);
      setMessage(null);
      setError(null);
      try {
        const res = await fetch('/api/account/usage-alerts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        });
        const j = (await res.json()) as UsageAlertPrefs & { error?: string };
        if (!res.ok) {
          setError(j.error ?? 'Could not save');
          return;
        }
        setPrefs({
          usageQuotaAlertsEnabled: j.usageQuotaAlertsEnabled,
          usageAlertAt75: j.usageAlertAt75,
          usageAlertAt85: j.usageAlertAt85,
          usageAlertAt95: j.usageAlertAt95,
        });
        setMessage('Saved.');
      } finally {
        setSaving(false);
      }
    },
    []
  );

  return (
    <section className="card dashboard-card usage-alert-settings">
      <div className="dashboard-card-head usage-alert-head">
        <h2>API quota email alerts</h2>
        {saving ? <span className="usage-alert-status">Saving…</span> : null}
      </div>
      <p className="dashboard-muted usage-alert-lead">
        When monthly API usage (UTC calendar month) crosses <strong>75%</strong>, <strong>85%</strong>, or{' '}
        <strong>95%</strong> of your plan limit, we can email this account. Configure SMTP on the server for delivery
        (<code className="usage-alert-code">SMTP_HOST</code> in environment).
      </p>

      {error && <p className="error dashboard-gap">{error}</p>}
      {message && !error && <p className="dashboard-muted dashboard-gap">{message}</p>}

      <div className="usage-alert-master">
        <label className="usage-alert-row">
          <input
            className="usage-alert-input"
            type="checkbox"
            checked={prefs.usageQuotaAlertsEnabled}
            disabled={saving}
            onChange={(e) => void patch({ usageQuotaAlertsEnabled: e.target.checked })}
          />
          <span className="usage-alert-row-text">
            <span className="usage-alert-row-title">Enable quota alert emails</span>
            <span className="usage-alert-row-desc">Master switch for messages at each threshold below.</span>
          </span>
        </label>
      </div>

      <div
        className={`usage-alert-panel${!prefs.usageQuotaAlertsEnabled || saving ? ' is-disabled' : ''}`}
        role="group"
        aria-labelledby="usage-alert-thresholds-title"
      >
        <p id="usage-alert-thresholds-title" className="usage-alert-panel-title">
          Thresholds (UTC month)
        </p>
        <div className="usage-alert-list">
          <label className="usage-alert-row">
            <input
              className="usage-alert-input"
              type="checkbox"
              checked={prefs.usageAlertAt75}
              disabled={!prefs.usageQuotaAlertsEnabled || saving}
              onChange={(e) => void patch({ usageAlertAt75: e.target.checked })}
            />
            <span className="usage-alert-row-text">
              <span className="usage-alert-row-title">75% of monthly quota</span>
              <span className="usage-alert-row-desc">First heads-up when usage accelerates.</span>
            </span>
          </label>
          <label className="usage-alert-row">
            <input
              className="usage-alert-input"
              type="checkbox"
              checked={prefs.usageAlertAt85}
              disabled={!prefs.usageQuotaAlertsEnabled || saving}
              onChange={(e) => void patch({ usageAlertAt85: e.target.checked })}
            />
            <span className="usage-alert-row-text">
              <span className="usage-alert-row-title">85% of monthly quota</span>
              <span className="usage-alert-row-desc">Plan an upgrade or pace traffic.</span>
            </span>
          </label>
          <label className="usage-alert-row">
            <input
              className="usage-alert-input"
              type="checkbox"
              checked={prefs.usageAlertAt95}
              disabled={!prefs.usageQuotaAlertsEnabled || saving}
              onChange={(e) => void patch({ usageAlertAt95: e.target.checked })}
            />
            <span className="usage-alert-row-text">
              <span className="usage-alert-row-title">95% of monthly quota</span>
              <span className="usage-alert-row-desc">Almost at your plan ceiling.</span>
            </span>
          </label>
        </div>
      </div>

      <p className="dashboard-muted usage-alert-footnote">
        Unlimited plans skip quota mailers. One email per threshold per UTC month.
      </p>
    </section>
  );
}
