import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'SSLCommerz plans in BDT — Starter & Pro with Baileys dashboard pairing, REST APIs, webhooks, and automatic entitlement.',
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
