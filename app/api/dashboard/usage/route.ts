import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUsageSummary } from '@/lib/api-usage';
import { hasActiveEntitlement } from '@/lib/entitlement';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const entitled = await hasActiveEntitlement(session.user.id);
  if (!entitled) {
    return NextResponse.json({ error: 'Active subscription required' }, { status: 403 });
  }

  const summary = await getUsageSummary(session.user.id);
  return NextResponse.json(summary);
}
