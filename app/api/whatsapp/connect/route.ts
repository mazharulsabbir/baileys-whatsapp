import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasActiveEntitlement } from '@/lib/entitlement';
import { rateLimit } from '@/lib/rate-limit';
import { ensureConnecting } from '@/lib/whatsapp-registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = rateLimit(`wa-connect:${session.user.id}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many connect attempts' }, { status: 429 });
  }

  const entitled = await hasActiveEntitlement(session.user.id);
  if (!entitled) {
    return NextResponse.json({ error: 'Active subscription required' }, { status: 403 });
  }

  try {
    await ensureConnecting(session.user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Could not start WhatsApp connection' }, { status: 500 });
  }
}
