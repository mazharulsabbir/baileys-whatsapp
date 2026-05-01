export const PLANS = {
  starter: {
    slug: 'starter',
    name: 'Starter',
    description: 'Single WhatsApp number, standard messaging',
    amount: '999.00',
    currency: 'BDT',
    durationDays: 30,
  },
  pro: {
    slug: 'pro',
    name: 'Pro',
    description: 'Higher limits and priority',
    amount: '1999.00',
    currency: 'BDT',
    durationDays: 30,
  },
} as const;

export type PlanSlug = keyof typeof PLANS;

export function getPlan(slug: string) {
  if (slug in PLANS) return PLANS[slug as PlanSlug];
  return null;
}
