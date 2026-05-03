import path from 'path';
import fs from 'fs';
import {
  createWhatsAppService,
  WhatsAppService,
} from '../src/services/whatsapp';
import config from '../src/config';
import { deliverInboundWebhook } from './webhook-outbound';
import { deliverOdooPhoneStatus } from './odoo-webhook-delivery';

const instances = new Map<string, WhatsAppService>();
const restoreInFlight = new Map<string, Promise<void>>();

export function getSessionRoot(): string {
  return process.env.WHATSAPP_SESSION_ROOT ?? path.join(process.cwd(), 'sessions');
}

export function getExistingService(userId: string): WhatsAppService | undefined {
  return instances.get(userId);
}

/** Saved Baileys creds folder for this tenant (session root + sanitized id). */
export function hasPersistedAuth(userId: string): boolean {
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dir = path.join(getSessionRoot(), safeId);
  return fs.existsSync(path.join(dir, 'creds.json'));
}

/**
 * Resume a WhatsApp socket after server restart without requiring "Connect".
 * Deduped in-flight calls per tenant.
 */
export function scheduleSessionRestore(userId: string): void {
  if (instances.has(userId)) return;
  if (!hasPersistedAuth(userId)) return;
  if (restoreInFlight.has(userId)) return;
  const p: Promise<void> = ensureConnecting(userId)
    .then(() => undefined)
    .catch((err) =>
      console.error('[WhatsApp] background session restore failed', { userId, err }),
    )
    .finally(() => restoreInFlight.delete(userId));
  restoreInFlight.set(userId, p);
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
    syncFullHistory: config.syncFullHistory,
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
    await svc.disconnect({
      logoutFromServer: true,
      removeCredentials: true,
    });
    instances.delete(userId);
  }
}
