import path from 'path';
import {
  createWhatsAppService,
  WhatsAppService,
} from '../src/services/whatsapp';
import { deliverInboundWebhook } from './webhook-outbound';
import { deliverOdooPhoneStatus } from './odoo-webhook-delivery';

const instances = new Map<string, WhatsAppService>();

export function getSessionRoot(): string {
  return process.env.WHATSAPP_SESSION_ROOT ?? path.join(process.cwd(), 'sessions');
}

export function getExistingService(userId: string): WhatsAppService | undefined {
  return instances.get(userId);
}

export function getAllServices(): Map<string, WhatsAppService> {
  return instances;
}

export async function ensureConnecting(userId: string): Promise<WhatsAppService> {
  const existing = instances.get(userId);
  if (existing) {
    if (!existing.isConnected()) {
      await existing.connect().catch(() => {
        /* connection errors surfaced via API */
      });
    }
    return existing;
  }

  const svc = createWhatsAppService({
    tenantId: userId,
    authBaseDir: getSessionRoot(),
    authMethod: 'qr',
    printQRInTerminal: false,
    autoReconnect: true,
    onInboundWebhook: (payload) => deliverInboundWebhook(payload.tenantId, payload),
    onConnectionState: (state) => {
      deliverOdooPhoneStatus(userId, state);
    },
  });
  instances.set(userId, svc);
  await svc.connect().catch(() => {
    /* surfaced to client */
  });
  return svc;
}

export async function disconnectTenant(userId: string): Promise<void> {
  const svc = instances.get(userId);
  if (svc) {
    await svc.disconnect();
    instances.delete(userId);
  }
}
