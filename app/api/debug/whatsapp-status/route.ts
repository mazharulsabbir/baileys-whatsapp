import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasActiveEntitlement } from '@/lib/entitlement';
import { getExistingService, getAllServices } from '@/lib/whatsapp-registry';
import { isDebugApiAllowed } from '@/lib/debug-api';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Debug endpoint to troubleshoot WhatsApp connection issues.
 * Disabled in production unless `DEBUG_API_ENABLED=true`.
 * GET /api/debug/whatsapp-status
 */
export async function GET() {
  if (!isDebugApiAllowed()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  const debug: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    authentication: {
      authenticated: true,
      userId,
      email: session.user.email ?? null,
    },
    entitlement: {
      checked: false,
      hasActive: false,
      error: null as string | null,
    },
    whatsappService: {
      exists: false,
      connected: false,
      hasQr: false,
      qrValue: null as string | null,
      socketInitialized: false,
    },
    globalRegistry: {
      /** Total in-memory slots (all tenants); never list other tenants' ids. */
      totalServices: 0,
      activeConnections: 0,
      thisTenantRegistered: false,
    },
    sessionFiles: {
      exists: false,
      path: '',
      files: [] as string[],
    },
    recommendations: [] as string[],
  };

  try {
    const entitled = await hasActiveEntitlement(userId);
    debug.entitlement = { checked: true, hasActive: entitled, error: null };

    if (!entitled) {
      (debug.recommendations as string[]).push(
        'No active subscription. Complete checkout or extend entitlement from the dashboard.'
      );
    }
  } catch (error) {
    debug.entitlement = {
      checked: true,
      hasActive: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    (debug.recommendations as string[]).push('Failed to check entitlement. Database may be unavailable.');
  }

  const svc = getExistingService(userId);
  if (svc) {
    const ws = debug.whatsappService as Record<string, unknown>;
    ws.exists = true;
    ws.connected = svc.isConnected();
    ws.socketInitialized = Boolean(svc.getSocket());
    const qr = svc.getLatestQr();
    ws.hasQr = Boolean(qr);
    ws.qrValue = qr ? `${qr.substring(0, 50)}...` : null;

    if (!svc.isConnected() && !qr) {
      (debug.recommendations as string[]).push(
        'Service exists but no QR code. Click "Connect" or wait for QR generation.'
      );
    }
    if (svc.isConnected()) {
      (debug.recommendations as string[]).push('WhatsApp is already connected.');
    }
  } else {
    (debug.recommendations as string[]).push('No in-memory service for this tenant. Use Connect in the dashboard.');
  }

  const allServices = getAllServices();
  const gr = debug.globalRegistry as Record<string, unknown>;
  gr.totalServices = allServices.size;
  gr.activeConnections = Array.from(allServices.values()).filter((s) => s.isConnected()).length;
  gr.thisTenantRegistered = allServices.has(userId);

  const sessionRoot = process.env.WHATSAPP_SESSION_ROOT || path.join(process.cwd(), 'sessions');
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const sessionPath = path.join(sessionRoot, safeId);
  const sf = debug.sessionFiles as Record<string, unknown>;
  sf.path = sessionPath;

  try {
    if (fs.existsSync(sessionPath)) {
      sf.exists = true;
      sf.files = fs.readdirSync(sessionPath);
      if ((sf.files as string[]).length > 0) {
        (debug.recommendations as string[]).push('Session files on disk — prior pairing may resume after connect.');
      }
    } else {
      sf.exists = false;
      (debug.recommendations as string[]).push('No session directory yet — expected on first setup.');
    }
  } catch {
    sf.exists = false;
  }

  const ent = debug.entitlement as { hasActive?: boolean };
  const ws = debug.whatsappService as { exists?: boolean; connected?: boolean; hasQr?: boolean };
  if (ent.hasActive && !ws.exists) {
    (debug.recommendations as string[]).push('Ready to connect from the WhatsApp dashboard tab.');
  }
  if (ws.exists && !ws.connected && ws.hasQr) {
    (debug.recommendations as string[]).push('QR present — scan from the phone\'s Linked devices.');
  }

  return NextResponse.json(debug, { status: 200 });
}
