'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode, SVGProps } from 'react';
import {
  IconChart,
  IconIntegration,
  IconOverview,
  IconSubscription,
  IconUser,
  IconWhatsApp,
} from '@/components/dashboard/dashboard-icons';

type IconComp = (props: SVGProps<SVGSVGElement>) => ReactNode;

const NAV_ITEMS: readonly {
  href: string;
  label: string;
  Icon: IconComp;
  match: (p: string) => boolean;
}[] = [
  { href: '/dashboard', label: 'Overview', Icon: IconOverview, match: (p) => p === '/dashboard' },
  { href: '/dashboard/account', label: 'Account', Icon: IconUser, match: (p) => p.startsWith('/dashboard/account') },
  {
    href: '/dashboard/subscription',
    label: 'Subscription',
    Icon: IconSubscription,
    match: (p) => p.startsWith('/dashboard/subscription'),
  },
  { href: '/dashboard/usage', label: 'API usage', Icon: IconChart, match: (p) => p.startsWith('/dashboard/usage') },
  {
    href: '/dashboard/whatsapp',
    label: 'WhatsApp',
    Icon: IconWhatsApp,
    match: (p) => p.startsWith('/dashboard/whatsapp'),
  },
  {
    href: '/dashboard/integration',
    label: 'Integration',
    Icon: IconIntegration,
    match: (p) => p.startsWith('/dashboard/integration'),
  },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="dashboard-app">
      <aside className="dashboard-sidebar" aria-label="Dashboard sections">
        <div className="dashboard-sidebar-head">
          <span className="dashboard-sidebar-badge" aria-hidden />
          <div>
            <span className="dashboard-sidebar-title">Console</span>
            <span className="dashboard-sidebar-sub">Workspace</span>
          </div>
        </div>
        <nav className="dashboard-sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            const Icon = item.Icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? 'dashboard-sidebar-link is-active' : 'dashboard-sidebar-link'}
              >
                <span className="dashboard-sidebar-icon" aria-hidden>
                  <Icon />
                </span>
                <span className="dashboard-sidebar-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="dashboard-app-main">{children}</div>
    </div>
  );
}
