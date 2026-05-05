import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { getEntitlement } from '@/lib/entitlement';
import { getPlan } from '@/lib/plans';

export type QuotaStatus = {
  unlimited: boolean;
  limit: number | null;
  used: number;
  periodKey: string;
  planSlug: string | null;
};

/** Current UTC calendar month (billing month for quotas). */
export function getUtcBillingMonth(): { start: Date; end: Date; periodKey: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0));
  const periodKey = `${y}-${String(m + 1).padStart(2, '0')}`;
  return { start, end, periodKey };
}

export async function countMonthlyApiCalls(userId: string): Promise<number> {
  const { start, end } = getUtcBillingMonth();
  return prisma.apiUsageEvent.count({
    where: { userId, createdAt: { gte: start, lt: end } },
  });
}

/**
 * Quota for dashboard / analytics. When entitlement is missing or inactive, returns zeros and unlimited-ish display handled by caller.
 */
export async function getMonthlyQuotaStatus(userId: string): Promise<QuotaStatus> {
  const { periodKey } = getUtcBillingMonth();
  const ent = await getEntitlement(userId);
  if (!ent) {
    return { unlimited: true, limit: null, used: 0, periodKey, planSlug: null };
  }
  const plan = getPlan(ent.planSlug);
  const limit = plan?.monthlyApiQuota ?? null;
  const unlimited = limit == null;
  const used = await countMonthlyApiCalls(userId);
  return {
    unlimited,
    limit: unlimited ? null : limit,
    used,
    periodKey,
    planSlug: ent.planSlug,
  };
}

/** Block the next API call if the monthly quota is already exhausted. Call after `hasActiveEntitlement` passes. */
export async function assertMonthlyQuotaAllowsNextCall(userId: string): Promise<NextResponse | null> {
  const ent = await getEntitlement(userId);
  if (!ent || ent.status !== 'active' || ent.validUntil <= new Date()) {
    return null;
  }
  const plan = getPlan(ent.planSlug);
  const limit = plan?.monthlyApiQuota ?? null;
  if (limit == null) return null;

  const used = await countMonthlyApiCalls(userId);
  if (used < limit) return null;

  const { periodKey } = getUtcBillingMonth();
  return NextResponse.json(
    {
      error:
        'Monthly API quota exceeded for your plan. Upgrade on the pricing page or wait until the next UTC calendar month.',
      used,
      limit,
      billingMonthUtc: periodKey,
    },
    { status: 429 }
  );
}
