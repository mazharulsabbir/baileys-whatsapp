import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { disconnectTenant } from '@/lib/whatsapp-registry';

export const runtime = 'nodejs';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await disconnectTenant(session.user.id);
  return NextResponse.json({ ok: true });
}
