import { NextResponse } from 'next/server';
import { hasActiveEntitlement } from '@/lib/entitlement';
import {
  extractApiKeyFromRequest,
  resolveUserIdFromApiKey,
} from '@/lib/integration-auth';
import { recordApiUsage } from '@/lib/api-usage';
import { getExistingService } from '@/lib/whatsapp-registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const rawKey = extractApiKeyFromRequest(request.headers);
  const userId = await resolveUserIdFromApiKey(rawKey);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const entitled = await hasActiveEntitlement(userId);
  if (!entitled) {
    return NextResponse.json({ error: 'Active subscription required' }, { status: 403 });
  }

  const svc = getExistingService(userId);
  const connected = Boolean(svc?.isConnected());
  const waitingForQr = Boolean(svc && !connected && svc.getLatestQr());

  void recordApiUsage(userId, 'status');

  return NextResponse.json({
    connected,
    waitingForQr,
    tenantId: userId,
  });
}
