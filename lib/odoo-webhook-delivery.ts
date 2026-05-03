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

const PREFIX = '[Odoo webhook]';

function clip(s: string, max = 500): string {
  const x = s.replace(/\s+/g, ' ').trim();
  return x.length <= max ? x : `${x.slice(0, max)}…`;
}

/** Ensure fetch() accepts the URL (`localhost:8069/...` does not work without a scheme). */
function normalizeWebhookUrl(raw: string): string | null {
  const u = raw.trim();
  if (!u) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) return u;
  return `http://${u}`;
}

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
    console.warn(
      PREFIX,
      'skipped POST: empty payload (no messages/events/updates)'
    );
    return { ok: false, error: 'empty payload' };
  }

  const url = normalizeWebhookUrl(webhookUrl);
  if (!url) {
    console.error(PREFIX, 'invalid or empty webhook URL:', webhookUrl);
    return { ok: false, error: 'invalid webhook URL' };
  }
  if (url !== webhookUrl.trim()) {
    console.log(PREFIX, 'normalized URL (added scheme):', url);
  }

  // Older Odoo handlers expected JSON-RPC `params`; our controller accepts plain or wrapped bodies.
  const wrappedBody = { params: body };
  const raw = JSON.stringify(wrappedBody);
  let lastErr = 'unknown';

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      console.log(PREFIX, `attempt ${attempt + 1}/${MAX_ATTEMPTS}`, '→', url, '| bytes=', raw.length, {
        messages: body.messages?.length ?? 0,
        events: body.events?.length ?? 0,
        updates: body.updates?.length ?? 0,
      });

      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 20_000);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: raw,
        signal: ac.signal,
      });
      clearTimeout(t);

      const text = await res.text().catch(() => '');
      console.log(
        PREFIX,
        'response',
        res.status,
        res.statusText,
        '| ct=',
        res.headers.get('content-type') ?? '(none)',
        '| body=',
        clip(text || '(empty)', 600)
      );

      if (res.ok) {
        return { ok: true, status: res.status };
      }

      lastErr = `${res.status} ${text || res.statusText}`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      console.error(PREFIX, 'request failed:', lastErr);
    }

    const delay = BASE_DELAY_MS * Math.pow(2, attempt);
    await new Promise((r) => setTimeout(r, delay));
  }

  console.error(PREFIX, 'giving up after', MAX_ATTEMPTS, 'attempts:', lastErr);
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

  console.log(PREFIX, 'deliverToOdoo', {
    userId,
    webhookUrl: url ?? '(not set)',
    messages: body.messages?.length ?? 0,
    events: body.events?.length ?? 0,
    updates: body.updates?.length ?? 0,
  });

  if (!url) {
    console.warn(PREFIX, 'skip: no webhook URL for user', userId);
    return;
  }

  const result = await postAcuxPayloadWithRetries(url, body);

  console.log(PREFIX, 'delivery finished', result);

  if (result.ok) return;

  console.error(PREFIX, 'delivery failed → DLQ:', result.error);
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
  }).catch((e) =>
    console.error(PREFIX, 'Unhandled error in inbound delivery:', e)
  );
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
  })().catch((e) =>
    console.error(PREFIX, 'Unhandled error in phone-status delivery:', e)
  );
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
  })().catch((e) =>
    console.error(PREFIX, 'Unhandled error in delete-event delivery:', e)
  );
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
  })().catch((e) =>
    console.error(PREFIX, 'Unhandled error in failed-message delivery:', e)
  );
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
