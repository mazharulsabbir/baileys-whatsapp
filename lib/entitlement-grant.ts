import { prisma } from '@/lib/prisma';
import { getPlan } from '@/lib/plans';

/**
 * Next entitlement end date after purchasing `planSlug`.
 * Renewals stack: extend from max(now, currentValidUntil); new subscribers start from now.
 */
export function computeExtendedValidUntil(
  existingValidUntil: Date | null | undefined,
  planSlug: string
): Date {
  const plan = getPlan(planSlug);
  const days = plan?.durationDays ?? 30;
  const base =
    existingValidUntil != null
      ? new Date(Math.max(Date.now(), existingValidUntil.getTime()))
      : new Date();
  const validUntil = new Date(base);
  validUntil.setDate(validUntil.getDate() + days);
  return validUntil;
}

/** Extend or create subscription window using plan duration (stacks when already active). */
export async function grantSubscription(userId: string, planSlug: string): Promise<void> {
  const plan = getPlan(planSlug);
  const existing = await prisma.entitlement.findUnique({ where: { userId } });
  const validUntil = computeExtendedValidUntil(existing?.validUntil ?? null, planSlug);

  await prisma.entitlement.upsert({
    where: { userId },
    create: {
      userId,
      planSlug: plan?.slug ?? planSlug,
      status: 'active',
      validUntil,
    },
    update: {
      planSlug: plan?.slug ?? planSlug,
      status: 'active',
      validUntil,
    },
  });
}
