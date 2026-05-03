import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hasActiveEntitlement } from '@/lib/entitlement';
import {
  extractGatewayAuth,
  resolveUserIdFromGatewayHeaders,
} from '@/lib/gateway-auth';
import { updateOdooConfigSet } from '@/lib/odoo-gateway-credential';
import { recordApiUsage } from '@/lib/api-usage';
import { rateLimit } from '@/lib/rate-limit';
import { normalizeToJid } from '@/lib/jid';
import { fetchOdooMediaBuffer, rasterToJpegForWhatsApp } from '@/lib/odoo-media-fetch';
import { ensureConnecting, getExistingService, disconnectTenant } from '@/lib/whatsapp-registry';
import type { WhatsAppService } from '@/src/services/whatsapp';
import {
  handleContactGet,
  handleContactGetAll,
  handleDeleteMessage,
  handleMsgSetRead,
  handleTemplateGet,
  handleWhatsappNumberGet,
} from '@/lib/odoo-gateway-actions';

/** Maps Connector.get_actions (apichat.io) to HTTP method names */
const ACTION_METHOD: Record<string, 'GET' | 'POST' | 'DELETE'> = {
  send: 'POST',
  msg_set_read: 'POST',
  config_get: 'GET',
  config_set: 'POST',
  status_get: 'GET',
  status_logout: 'POST',
  contact_get: 'GET',
  contact_get_all: 'GET',
  init_free_test: 'POST',
  whatsapp_number_get: 'GET',
  template_get: 'GET',
  opt_in: 'POST',
  delete_message: 'DELETE',
};

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

async function readJsonBody(req: Request): Promise<unknown> {
  try {
    const raw = await req.text();
    if (!raw?.trim()) {
      return undefined;
    }
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

async function buildStatusPayload(
  svc: WhatsAppService | undefined
): Promise<{ status: Record<string, unknown> }> {
  if (!svc) {
    return {
      status: {
        accountStatus: 'unknown',
        statusData: {
          title: 'Session',
          msg: 'Client not started. Open the product dashboard to connect WhatsApp.',
          substatus: 'disconnected',
        },
      },
    };
  }

  if (svc.isConnected()) {
    return { status: { accountStatus: 'authenticated' } };
  }

  const qrRaw = svc.getLatestQr();
  if (qrRaw) {
    const dataUrl = await QRCode.toDataURL(qrRaw, { margin: 1, width: 256, type: 'image/png' });
    return {
      status: {
        accountStatus: 'got qr code',
        qrCode: dataUrl,
      },
    };
  }

  return {
    status: {
      accountStatus: 'unknown',
      statusData: {
        title: 'Connecting',
        msg: 'Session is starting. Retry shortly or open the dashboard to display the QR code.',
        substatus: 'connecting',
      },
    },
  };
}

const configSetSchema = z.object({
  webhook: z.string().url(),
  info: z.record(z.string(), z.unknown()).optional(),
});

/** Fields Odoo adds to every outbound payload (`acrux.chat.message.message_parse`). */
const sendCommonSchema = z.object({
  to: z.string().min(3),
  chat_type: z.string().optional(),
  id: z.union([z.string(), z.number()]).optional(),
  quote_msg_id: z.string().optional(),
});

const sendTextSchema = sendCommonSchema.extend({
  type: z.literal('text'),
  text: z.string().min(1),
});

/** Product drag-drop / attachments use `image` + public attachment URL + optional caption (`text`). */
const sendImageSchema = sendCommonSchema.extend({
  type: z.literal('image'),
  url: z.string().url(),
  filename: z.string().optional(),
  text: z.string().optional(),
});

const sendVideoSchema = sendCommonSchema.extend({
  type: z.literal('video'),
  url: z.string().url(),
  filename: z.string().optional(),
  text: z.string().optional(),
});

const sendFileSchema = sendCommonSchema.extend({
  type: z.literal('file'),
  url: z.string().url(),
  filename: z.string().optional(),
  text: z.string().optional(),
});

const sendAudioSchema = sendCommonSchema.extend({
  type: z.literal('audio'),
  url: z.string().url(),
});

const sendPayloadSchema = z.discriminatedUnion('type', [
  sendTextSchema,
  sendImageSchema,
  sendVideoSchema,
  sendFileSchema,
  sendAudioSchema,
]);

function captionFromOdoo(text: string | undefined): string | undefined {
  const t = text?.trim();
  return t ? t : undefined;
}

/**
 * Single entry: Odoo `ca_request` — same URL, `action` header routes behavior.
 */
export async function dispatchGatewayRequest(req: Request): Promise<NextResponse> {
  const { token, clientId, action } = extractGatewayAuth(req.headers);

  if (!action) {
    return jsonError('Missing action header', 400);
  }

  const expectedMethod = ACTION_METHOD[action];
  if (!expectedMethod) {
    return jsonError(`Unknown action: ${action}`, 400);
  }

  if (req.method !== expectedMethod) {
    return jsonError(`Method ${req.method} not allowed for action ${action}`, 400);
  }

  const userId = await resolveUserIdFromGatewayHeaders(token, clientId);
  if (!userId) {
    return jsonError('Forbidden', 403);
  }

  const entitled = await hasActiveEntitlement(userId);
  if (!entitled) {
    return jsonError('Active subscription required', 403);
  }

  const rl = rateLimit(`gateway:${userId}:${action}`, 120, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs ?? 1000) / 1000)) },
      }
    );
  }

  try {
    switch (action) {
      case 'status_get': {
        await ensureConnecting(userId);
        const svc = getExistingService(userId);
        const payload = await buildStatusPayload(svc);
        void recordApiUsage(userId, 'status');
        return NextResponse.json(payload);
      }

      case 'config_set': {
        const body = await readJsonBody(req);
        const parsed = configSetSchema.safeParse(body);
        if (!parsed.success) {
          return jsonError('Invalid config_set JSON body', 400);
        }
        try {
          await updateOdooConfigSet(userId, parsed.data.webhook, parsed.data.info);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'config_set failed';
          return jsonError(msg, 400);
        }
        void recordApiUsage(userId, 'status');
        return NextResponse.json({});
      }

      case 'config_get': {
        const row = await prisma.odooGatewayCredential.findUnique({
          where: { userId },
          select: { odooWebhookUrl: true, configSetInfo: true },
        });
        void recordApiUsage(userId, 'status');
        return NextResponse.json({
          webhook: row?.odooWebhookUrl ?? null,
          info: row?.configSetInfo ?? null,
        });
      }

      case 'send': {
        const body = await readJsonBody(req);
        const parsed = sendPayloadSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: 'Validation failed', details: parsed.error.flatten() },
            { status: 400 }
          );
        }

        try {
          await ensureConnecting(userId);
        } catch {
          return jsonError('Could not initialize WhatsApp client', 500);
        }

        const svc = getExistingService(userId);
        if (!svc?.isConnected()) {
          return jsonError('WhatsApp not connected. Scan QR in the dashboard.', 503);
        }

        try {
          const jid = normalizeToJid(parsed.data.to);
          let msgId: string | undefined;
          switch (parsed.data.type) {
            case 'text':
              msgId = await svc.sendMessage(jid, parsed.data.text);
              break;
            case 'image':
              {
                const raw = await fetchOdooMediaBuffer(parsed.data.url);
                const jpeg = await rasterToJpegForWhatsApp(raw);
                msgId = await svc.sendImage(jid, jpeg, captionFromOdoo(parsed.data.text));
              }
              break;
            case 'video':
              msgId = await svc.sendVideo(jid, parsed.data.url, captionFromOdoo(parsed.data.text));
              break;
            case 'file':
              msgId = await svc.sendDocument(
                jid,
                parsed.data.url,
                parsed.data.filename,
                captionFromOdoo(parsed.data.text)
              );
              break;
            case 'audio':
              msgId = await svc.sendAudio(jid, parsed.data.url);
              break;
            default: {
              const _exhaustive: never = parsed.data;
              return jsonError(`Unsupported send type: ${JSON.stringify(_exhaustive)}`, 400);
            }
          }
          void recordApiUsage(userId, 'messages');
          if (!msgId) {
            return NextResponse.json({ msg_id: `pending_${Date.now()}` });
          }
          return NextResponse.json({ msg_id: msgId });
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Send failed';
          return jsonError(msg, 400);
        }
      }

      case 'status_logout': {
        await disconnectTenant(userId);
        void recordApiUsage(userId, 'status');
        return NextResponse.json({});
      }

      case 'msg_set_read': {
        const body = await readJsonBody(req);
        void recordApiUsage(userId, 'messages');
        return handleMsgSetRead(userId, body);
      }

      case 'contact_get_all': {
        void recordApiUsage(userId, 'status');
        return handleContactGetAll(userId);
      }

      case 'contact_get': {
        const sp = new URL(req.url).searchParams;
        void recordApiUsage(userId, 'status');
        return handleContactGet(userId, sp);
      }

      case 'whatsapp_number_get': {
        const sp = new URL(req.url).searchParams;
        void recordApiUsage(userId, 'status');
        return handleWhatsappNumberGet(userId, sp);
      }

      case 'template_get': {
        void recordApiUsage(userId, 'status');
        return handleTemplateGet();
      }

      case 'opt_in': {
        void recordApiUsage(userId, 'messages');
        return NextResponse.json({});
      }

      case 'init_free_test': {
        void recordApiUsage(userId, 'status');
        return jsonError(
          'Provisioning is done in this product dashboard (Odoo gateway credentials), not via init_free_test.',
          400
        );
      }

      case 'delete_message': {
        const sp = new URL(req.url).searchParams;
        void recordApiUsage(userId, 'messages');
        return handleDeleteMessage(userId, sp);
      }

      default:
        return jsonError(`Unsupported action: ${action}`, 400);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    return jsonError(msg, 500);
  }
}
