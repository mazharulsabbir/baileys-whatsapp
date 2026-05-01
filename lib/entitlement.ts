import { prisma } from '@/lib/prisma';

export async function hasActiveEntitlement(userId: string): Promise<boolean> {
  const row = await prisma.entitlement.findUnique({
    where: { userId },
  });
  if (!row || row.status !== 'active') return false;
  return row.validUntil > new Date();
}

export async function getEntitlement(userId: string) {
  return prisma.entitlement.findUnique({ where: { userId } });
}
