import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import type { InboundWebhookPayload } from '../src/webhook-types';

export type { InboundWebhookPayload };

/**
 * Fire-and-forget POST to user's Odoo (or other) webhook with HMAC signature.
 */
export function deliverInboundWebhook(
  tenantId: string,
  payload: InboundWebhookPayload
): void {
  void (async () => {
    try {
      const row = await prisma.integrationCredential.findUnique({
        where: { userId: tenantId },
      });
      if (!row?.enabled || !row.webhookUrl || !row.webhookSecret) {
        return;
      }

      const raw = JSON.stringify({
        ...payload,
        timestamp:
          payload.timestamp != null && typeof payload.timestamp === 'object'
            ? Number(payload.timestamp)
            : payload.timestamp,
      });

      const sig = crypto
        .createHmac('sha256', row.webhookSecret)
        .update(raw)
        .digest('hex');

      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 8000);

      await fetch(row.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': `sha256=${sig}`,
          'X-Baileys-Webhook-Event': payload.event,
        },
        body: raw,
        signal: ac.signal,
      }).catch(() => {});

      clearTimeout(t);
    } catch {
      /* never throw into Baileys */
    }
  })();
}
