import type { Metadata } from 'next';
import { PRODUCT_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Pricing',
  description: `SSLCommerz plans in BDT — API quota tiers with ${PRODUCT_NAME}: dashboard pairing, REST APIs, webhooks, Odoo gateway.`,
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
