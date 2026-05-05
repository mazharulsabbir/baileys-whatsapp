import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Nav } from './nav';
import { SiteFooter } from '@/components/marketing/site-footer';
import { auth } from '@/auth';
import { PRODUCT_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: {
    default: PRODUCT_NAME,
    template: `%s · ${PRODUCT_NAME}`,
  },
  description:
    'Enterprise-grade WhatsApp Web connectivity — SSLCommerz billing in BDT, tenant isolation, API quotas, and REST integrations.',
  openGraph: {
    title: PRODUCT_NAME,
    description:
      'Production-ready WhatsApp automation: dashboard QR onboarding, quota-aware APIs, Odoo-compatible gateway.',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="site-root">
            <Nav />
            <main className="site-main">{children}</main>
            {!session && <SiteFooter />}
          </div>
        </Providers>
      </body>
    </html>
  );
}
