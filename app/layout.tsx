import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Nav } from './nav';
import { SiteFooter } from '@/components/marketing/site-footer';

export const metadata: Metadata = {
  title: {
    default: 'Baileys WhatsApp SaaS',
    template: '%s · Baileys SaaS',
  },
  description:
    'WhatsApp Web connectivity on Baileys with SSLCommerz billing, tenant isolation, and REST APIs for integrations.',
  openGraph: {
    title: 'Baileys WhatsApp SaaS',
    description: 'Production-ready WhatsApp automation with dashboard QR onboarding and BDT checkout.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="site-root">
            <Nav />
            <main className="site-main">{children}</main>
            <SiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
