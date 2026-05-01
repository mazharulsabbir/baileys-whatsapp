import { auth } from '@/auth';
import { getEntitlement } from '@/lib/entitlement';
import { DashboardClient } from './dashboard-client';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return null;
  }

  const ent = await getEntitlement(session.user.id);
  const hasActive =
    !!ent && ent.status === 'active' && ent.validUntil.getTime() > Date.now();

  return (
    <DashboardClient
      email={session.user.email}
      entitlement={
        ent
          ? {
              planSlug: ent.planSlug,
              status: ent.status,
              validUntil: ent.validUntil.toISOString(),
            }
          : null
      }
      hasActive={hasActive}
    />
  );
}
