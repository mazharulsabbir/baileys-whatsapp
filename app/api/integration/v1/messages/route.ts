import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasActiveEntitlement } from '@/lib/entitlement';
import {
  extractApiKeyFromRequest,
  resolveUserIdFromApiKey,
} from '@/lib/integration-auth';
import { normalizeToJid } from '@/lib/jid';
import { recordApiUsage } from '@/lib/api-usage';
import { rateLimit } from '@/lib/rate-limit';
import { ensureConnecting, getExistingService } from '@/lib/whatsapp-registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  to: z.string().min(3),
  type: z.literal('text'),
  text: z.string().min(1).max(4096),
});

export async function POST(req: Request) {
  const rawKey = extractApiKeyFromRequest(req.headers);
  const userId = await resolveUserIdFromApiKey(rawKey);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = rateLimit(`int-msg:${userId}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs ?? 1000) / 1000)) } }
    );
  }

  const entitled = await hasActiveEntitlement(userId);
  if (!entitled) {
    return NextResponse.json({ error: 'Active subscription required' }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    await ensureConnecting(userId);
  } catch {
    return NextResponse.json({ error: 'Could not initialize WhatsApp client' }, { status: 500 });
  }

  const svc = getExistingService(userId);
  if (!svc?.isConnected()) {
    return NextResponse.json(
      { error: 'WhatsApp not connected. Scan QR in the dashboard.' },
      { status: 503 }
    );
  }

  try {
    const jid = normalizeToJid(parsed.data.to);
    await svc.sendMessage(jid, parsed.data.text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Send failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  void recordApiUsage(userId, 'messages');

  return NextResponse.json({ ok: true });
}
