import { prisma } from '@/lib/prisma';
import { getPlan } from '@/lib/plans';

/** Extend or create subscription window from today using plan duration. */
export async function grantSubscription(userId: string, planSlug: string): Promise<void> {
  const plan = getPlan(planSlug);
  const days = plan?.durationDays ?? 30;
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + days);

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
