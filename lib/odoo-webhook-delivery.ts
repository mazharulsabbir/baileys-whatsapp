import type { WAMessageKey } from '@whiskeysockets/baileys';
import { prisma } from '@/lib/prisma';
import { buildCompositeMsgId } from '@/lib/odoo-acrux-mapper';

export type AcuxWebhookBody = {
  messages?: unknown[];
  events?: unknown[];
  updates?: unknown[];
};

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;

/** POST JSON to Odoo `acrux_webhook` with retries (exponential backoff). */
export async function postAcuxPayloadWithRetries(
  webhookUrl: string,
  body: AcuxWebhookBody
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const hasPayload =
    (body.messages?.length ?? 0) +
      (body.events?.length ?? 0) +
      (body.updates?.length ?? 0) >
    0;
  if (!hasPayload) {
    return { ok: false, error: 'empty payload' };
  }

  // Odoo expects payload wrapped in 'params' key
  const wrappedBody = {
    params: body
  };

  const raw = JSON.stringify(wrappedBody);
  let lastErr = 'unknown';

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 20_000);
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: raw,
        signal: ac.signal,
      });
      clearTimeout(t);

      if (res.ok) {
        return { ok: true, status: res.status };
      }

      lastErr = `${res.status} ${await res.text().catch(() => res.statusText)}`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }

    const delay = BASE_DELAY_MS * Math.pow(2, attempt);
    await new Promise((r) => setTimeout(r, delay));
  }

  return { ok: false, error: lastErr };
}

async function getOdooWebhookUrl(userId: string): Promise<string | null> {
  const row = await prisma.odooGatewayCredential.findUnique({
    where: { userId },
    select: { odooWebhookUrl: true },
  });
  return row?.odooWebhookUrl?.trim() || null;
}

async function deliverToOdooWithDlq(
  userId: string,
  body: AcuxWebhookBody
): Promise<void> {
  const url = await getOdooWebhookUrl(userId);

  // Enhanced logging
  console.log('[WEBHOOK DEBUG] deliverToOdooWithDlq called', {
    userId,
    webhookUrl: url,
    hasMessages: (body.messages?.length ?? 0) > 0,
    hasEvents: (body.events?.length ?? 0) > 0,
    messageCount: body.messages?.length ?? 0
  });

  if (!url) {
    console.warn('[WEBHOOK DEBUG] No webhook URL configured for user:', userId);
    return;
  }

  console.log('[WEBHOOK DEBUG] Attempting POST to:', url);
  const result = await postAcuxPayloadWithRetries(url, body);

  console.log('[WEBHOOK DEBUG] POST result:', {
    ok: result.ok,
    status: result.status,
    error: result.error
  });

  if (result.ok) return;

  console.error('[WEBHOOK DEBUG] Webhook delivery failed, adding to DLQ:', result.error);
  await prisma.odooWebhookDeadLetter.create({
    data: {
      userId,
      webhookUrl: url,
      payload: body as object,
      lastError: result.error ?? 'delivery failed',
    },
  });
}

/** Fire-and-forget: one prepared Acrux row (after media hosting). */
export function deliverAcuxInboundRow(
  userId: string,
  row: Record<string, unknown>
): void {
  void deliverToOdooWithDlq(userId, {
    messages: [row],
    events: [],
    updates: [],
  });
}

/** WhatsApp connection → Odoo `phone-status`. */
export function deliverOdooPhoneStatus(
  userId: string,
  state: 'open' | 'close'
): void {
  void (async () => {
    const status = state === 'open' ? 'connected' : 'disconnected';
    await deliverToOdooWithDlq(userId, {
      messages: [],
      updates: [],
      events: [{ type: 'phone-status', status }],
    });
  })();
}

/** WhatsApp revoked messages → Odoo `deleted` event (`msgid` = composite id). */
export function deliverAcuxMessageDeletes(
  userId: string,
  keys: WAMessageKey[]
): void {
  void (async () => {
    const events = keys.map((k) => ({
      type: 'deleted' as const,
      msgid: buildCompositeMsgId({
        id: k.id,
        remoteJid: k.remoteJid,
        remoteJidAlt: k.remoteJidAlt,
        fromMe: k.fromMe ?? false,
      }),
    }));
    await deliverToOdooWithDlq(userId, {
      messages: [],
      updates: [],
      events,
    });
  })();
}

/**
 * Deliver failed message event to Odoo when message send fails.
 * Odoo expects: { type: 'failed', msgid, reason }
 */
export function deliverOdooFailedMessage(
  userId: string,
  msgid: string,
  reason: string
): void {
  void (async () => {
    await deliverToOdooWithDlq(userId, {
      messages: [],
      updates: [],
      events: [{
        type: 'failed' as const,
        msgid,
        reason: reason || 'Unknown error'
      }],
    });
  })();
}

export async function listOdooDeadLetters(userId: string, limit = 20) {
  return prisma.odooWebhookDeadLetter.findMany({
    where: { userId, resolvedAt: null },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      webhookUrl: true,
      lastError: true,
      createdAt: true,
    },
  });
}

export async function retryOdooDeadLetter(
  userId: string,
  dlqId: string
): Promise<{ ok: boolean; error?: string }> {
  const row = await prisma.odooWebhookDeadLetter.findFirst({
    where: { id: dlqId, userId, resolvedAt: null },
  });
  if (!row) {
    return { ok: false, error: 'Entry not found or already resolved' };
  }

  const body = row.payload as AcuxWebhookBody;
  const r = await postAcuxPayloadWithRetries(row.webhookUrl, body);

  if (r.ok) {
    await prisma.odooWebhookDeadLetter.update({
      where: { id: dlqId },
      data: { resolvedAt: new Date(), lastError: null },
    });
    return { ok: true };
  }

  await prisma.odooWebhookDeadLetter.update({
    where: { id: dlqId },
    data: { lastError: r.error ?? 'retry failed' },
  });
  return { ok: false, error: r.error };
}
