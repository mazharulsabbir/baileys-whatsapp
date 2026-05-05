export const PLANS = {
  starter: {
    slug: 'starter',
    name: 'Starter',
    description: 'Ship one tenant with WhatsApp Web and HTTPS APIs.',
    tagline: 'Ideal for proofs of concept',
    amount: '999.00',
    currency: 'BDT',
    durationDays: 30,
    featured: false,
    features: [
      'Tenant-isolated WhatsApp session (Baileys)',
      'Dashboard QR onboarding & disconnect',
      'REST messaging + status API keys',
      'SSLCommerz checkout in BDT',
      'Outbound webhooks per tenant',
    ],
  },
  pro: {
    slug: 'pro',
    name: 'Pro',
    description: 'Scale usage with higher limits for production traffic.',
    tagline: 'Most teams ship on Pro',
    amount: '1999.00',
    currency: 'BDT',
    durationDays: 30,
    featured: true,
    features: [
      'Everything in Starter',
      'Higher API throughput on shared infra',
      'Odoo / gateway adapters ready to wire',
      'Usage charts in dashboard',
      'Same SSLCommerz & IPN activation',
    ],
  },
} as const;

export type PlanSlug = keyof typeof PLANS;

export function getPlan(slug: string) {
  if (slug in PLANS) return PLANS[slug as PlanSlug];
  return null;
}
