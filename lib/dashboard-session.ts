import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getEntitlement } from '@/lib/entitlement';

export type DashboardEntitlementSnapshot = {
  planSlug: string;
  status: string;
  validUntil: string;
} | null;

/**
 * Session + plan state for dashboard routes (middleware already protects `/dashboard`).
 */
export async function getDashboardContext(): Promise<{
  userId: string;
  email: string;
  entitlement: DashboardEntitlementSnapshot;
  hasActive: boolean;
}> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    redirect('/login');
  }

  const ent = await getEntitlement(session.user.id);
  const hasActive =
    !!ent && ent.status === 'active' && ent.validUntil.getTime() > Date.now();

  return {
    userId: session.user.id,
    email: session.user.email,
    entitlement: ent
      ? {
          planSlug: ent.planSlug,
          status: ent.status,
          validUntil: ent.validUntil.toISOString(),
        }
      : null,
    hasActive,
  };
}
