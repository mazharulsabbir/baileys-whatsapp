/**
 * Commercial plans: monthly API call quota (UTC calendar month) + paid access window (`durationDays`).
 * `monthlyApiQuota`: number of integration API calls; `null` means unlimited.
 */
export const PLANS = {
  api_1k: {
    slug: 'api_1k',
    name: 'Build',
    description: 'Solo builders and internal tools with predictable traffic.',
    tagline: 'For prototypes and light automation',
    amount: '999.00',
    currency: 'BDT',
    durationDays: 30,
    monthlyApiQuota: 1000,
    featured: false,
    features: [
      'Up to 1,000 API calls / month (UTC)',
      'Dedicated WhatsApp tenant + dashboard QR',
      'REST messages & status API',
      'Integration webhooks',
      'Email alerts at 75% / 85% / 95% quota (optional)',
    ],
  },
  api_3k: {
    slug: 'api_3k',
    name: 'Team',
    description: 'Shared queues, Odoo connectors, and steady production messaging.',
    tagline: 'Most teams start here',
    amount: '1999.00',
    currency: 'BDT',
    durationDays: 30,
    monthlyApiQuota: 3000,
    featured: true,
    features: [
      'Up to 3,000 API calls / month (UTC)',
      'Everything in Build',
      'Higher throughput for shared workspaces',
      'Odoo gateway-friendly connector headers',
      'Usage charts + quota enforcement',
    ],
  },
  api_5k: {
    slug: 'api_5k',
    name: 'Business',
    description: 'Higher volume with room for campaigns and multi-department routing.',
    tagline: 'For busy inboxes',
    amount: '2999.00',
    currency: 'BDT',
    durationDays: 30,
    monthlyApiQuota: 5000,
    featured: false,
    features: [
      'Up to 5,000 API calls / month (UTC)',
      'Everything in Team',
      'Priority-style capacity on shared infra',
      'DLQ replay and integration diagnostics',
      'Same SSLCommerz checkout & IPN activation',
    ],
  },
  api_unlimited: {
    slug: 'api_unlimited',
    name: 'Scale',
    description: 'No fixed monthly API cap — for operators who outgrow stepped tiers.',
    tagline: 'Unmetered API calls (fair use)',
    amount: '4999.00',
    currency: 'BDT',
    durationDays: 30,
    monthlyApiQuota: null,
    featured: false,
    features: [
      'Unlimited API calls (fair use; abuse may be throttled)',
      'Everything in Business',
      'Best for high-volume or bursty traffic',
      'Quota alerts optional (less relevant for unlimited)',
      'Direct support path for scale questions',
    ],
  },
} as const;

export type PlanSlug = keyof typeof PLANS;

/** Maps legacy `starter` / `pro` checkout rows to current tiers. */
const LEGACY_PLAN_SLUG: Record<string, PlanSlug> = {
  starter: 'api_1k',
  pro: 'api_3k',
};

export function getPlan(slug: string) {
  const key = LEGACY_PLAN_SLUG[slug] ?? slug;
  if (key in PLANS) return PLANS[key as PlanSlug];
  return null;
}

export function formatApiQuotaLabel(monthlyApiQuota: number | null | undefined): string {
  if (monthlyApiQuota == null) return 'Unlimited API calls / month (UTC)';
  return `${monthlyApiQuota.toLocaleString()} API calls / month (UTC)`;
}
