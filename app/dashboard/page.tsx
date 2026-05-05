import Link from 'next/link';
import {
  IconArrowRight,
  IconChart,
  IconIntegration,
  IconSubscription,
  IconUser,
  IconWhatsApp,
} from '@/components/dashboard/dashboard-icons';
import { getDashboardContext } from '@/lib/dashboard-session';

export default async function DashboardOverviewPage() {
  const { entitlement, hasActive } = await getDashboardContext();

  const sections = [
    {
      href: '/dashboard/account',
      title: 'Account',
      description: 'Signed-in identity, session details, and sign out.',
      Icon: IconUser,
    },
    {
      href: '/dashboard/subscription',
      title: 'Subscription',
      description: 'Current plan, renewal date, and upgrade options.',
      Icon: IconSubscription,
    },
    {
      href: '/dashboard/usage',
      title: 'API usage',
      description: 'Request volume for your integration API keys.',
      Icon: IconChart,
    },
    {
      href: '/dashboard/whatsapp',
      title: 'WhatsApp',
      description: 'Pair this tenant with WhatsApp Web via QR code.',
      Icon: IconWhatsApp,
    },
    {
      href: '/dashboard/integration',
      title: 'Integration',
      description: 'API keys, webhooks, and connector credentials.',
      Icon: IconIntegration,
    },
  ] as const;

  return (
    <div className="page-shell dashboard-page">
      <div className="dashboard-hero">
        <div className="dashboard-hero-orbs" aria-hidden />
        <header className="dashboard-page-head dashboard-page-head-hero">
          <p className="dashboard-eyebrow">Control center</p>
          <h1>Overview</h1>
          <p className="dashboard-lead">
            Manage your subscription, WhatsApp session, and API integration from one workspace.
          </p>
        </header>
      </div>

      {!hasActive && (
        <div className="dashboard-spotlight dashboard-spotlight-warn">
          <div className="dashboard-spotlight-icon" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <p className="dashboard-spotlight-copy">
            <strong>No active subscription.</strong> Complete checkout to unlock WhatsApp pairing and API usage.{' '}
            <Link href="/pricing">View plans</Link>
          </p>
        </div>
      )}

      {hasActive && entitlement && (
        <div className="dashboard-spotlight dashboard-spotlight-ok">
          <div className="dashboard-spotlight-icon" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="dashboard-spotlight-copy">
            Active plan <span className="dashboard-spotlight-strong">{entitlement.planSlug}</span> · valid until{' '}
            <span className="dashboard-spotlight-strong">{new Date(entitlement.validUntil).toLocaleString()}</span>
          </p>
        </div>
      )}

      <div className="dashboard-overview-grid">
        {sections.map((s) => {
          const SectionIcon = s.Icon;
          return (
            <Link key={s.href} href={s.href} className="dashboard-overview-tile">
              <div className="dashboard-overview-tile-glow" aria-hidden />
              <span className="dashboard-overview-tile-icon" aria-hidden>
                <SectionIcon />
              </span>
              <div className="dashboard-overview-tile-body">
                <h2 className="dashboard-overview-tile-title">{s.title}</h2>
                <p className="dashboard-overview-tile-desc">{s.description}</p>
              </div>
              <span className="dashboard-overview-tile-arrow" aria-hidden>
                <IconArrowRight />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
