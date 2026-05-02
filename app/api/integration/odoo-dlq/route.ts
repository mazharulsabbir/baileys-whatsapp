import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasActiveEntitlement } from '@/lib/entitlement';
import { listOdooDeadLetters, retryOdooDeadLetter } from '@/lib/odoo-webhook-delivery';

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

  const items = await listOdooDeadLetters(session.user.id, 25);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const entitled = await hasActiveEntitlement(session.user.id);
  if (!entitled) {
    return NextResponse.json({ error: 'Active subscription required' }, { status: 403 });
  }

  let body: { action?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.action === 'retry' && body.id) {
    const out = await retryOdooDeadLetter(session.user.id, body.id);
    if (!out.ok) {
      return NextResponse.json({ error: out.error ?? 'Retry failed' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
