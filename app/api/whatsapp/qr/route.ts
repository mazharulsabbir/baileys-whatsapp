import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { auth } from '@/auth';
import { hasActiveEntitlement } from '@/lib/entitlement';
import { getExistingService, scheduleSessionRestore } from '@/lib/whatsapp-registry';

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

  scheduleSessionRestore(session.user.id);

  const svc = getExistingService(session.user.id);
  if (!svc) {
    return NextResponse.json({ connected: false, qrDataUrl: null as string | null });
  }

  const connected = svc.isConnected();
  const raw = svc.getLatestQr();
  let qrDataUrl: string | null = null;
  if (raw && !connected) {
    qrDataUrl = await QRCode.toDataURL(raw);
  }

  return NextResponse.json({ connected, qrDataUrl });
}
