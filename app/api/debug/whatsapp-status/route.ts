import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasActiveEntitlement } from '@/lib/entitlement';
import { getExistingService, getAllServices } from '@/lib/whatsapp-registry';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Debug endpoint to troubleshoot WhatsApp connection issues
 * GET /api/debug/whatsapp-status
 */
export async function GET() {
  const session = await auth();

  const debug: Record<string, any> = {
    timestamp: new Date().toISOString(),
    authentication: {
      authenticated: !!session?.user,
      userId: session?.user?.id || null,
      email: session?.user?.email || null
    },
    entitlement: {
      checked: false,
      hasActive: false,
      error: null as string | null
    },
    whatsappService: {
      exists: false,
      connected: false,
      hasQr: false,
      qrValue: null as string | null,
      socketInitialized: false
    },
    globalRegistry: {
      totalServices: 0,
      activeConnections: 0,
      serviceIds: [] as string[]
    },
    sessionFiles: {
      exists: false,
      path: '',
      files: [] as string[]
    },
    recommendations: [] as string[]
  };

  // Check authentication
  if (!session?.user?.id) {
    debug.recommendations.push('User is not authenticated. Please login first.');
    return NextResponse.json(debug, { status: 200 });
  }

  const userId = session.user.id;

  // Check entitlement
  try {
    const entitled = await hasActiveEntitlement(userId);
    debug.entitlement.checked = true;
    debug.entitlement.hasActive = entitled;

    if (!entitled) {
      debug.recommendations.push('No active subscription found. Add an entitlement to the database.');
      debug.recommendations.push(`SQL: INSERT INTO "Entitlement" ("userId", "planSlug", status, "validUntil", "createdAt", "updatedAt") VALUES ('${userId}', 'premium', 'active', NOW() + INTERVAL '30 days', NOW(), NOW()) ON CONFLICT ("userId") DO UPDATE SET status = 'active', "validUntil" = NOW() + INTERVAL '30 days';`);
    }
  } catch (error) {
    debug.entitlement.error = error instanceof Error ? error.message : 'Unknown error';
    debug.recommendations.push('Failed to check entitlement. Database may be unavailable.');
  }

  // Check WhatsApp service for this user
  const svc = getExistingService(userId);
  if (svc) {
    debug.whatsappService.exists = true;
    debug.whatsappService.connected = svc.isConnected();
    debug.whatsappService.socketInitialized = !!svc.getSocket();

    const qr = svc.getLatestQr();
    debug.whatsappService.hasQr = !!qr;
    debug.whatsappService.qrValue = qr ? qr.substring(0, 50) + '...' : null;

    if (!debug.whatsappService.connected && !debug.whatsappService.hasQr) {
      debug.recommendations.push('Service exists but no QR code. Click "Connect" button or wait for QR to be generated.');
    }
    if (debug.whatsappService.connected) {
      debug.recommendations.push('WhatsApp is already connected! No QR needed.');
    }
  } else {
    debug.whatsappService.exists = false;
    debug.recommendations.push('No WhatsApp service found for this user. Click "Connect" button to initialize.');
  }

  // Check global registry
  const allServices = getAllServices();
  debug.globalRegistry.totalServices = allServices.size;
  debug.globalRegistry.serviceIds = Array.from(allServices.keys());
  debug.globalRegistry.activeConnections = Array.from(allServices.values()).filter(
    s => s.isConnected()
  ).length;

  // Check session files
  const sessionRoot = process.env.WHATSAPP_SESSION_ROOT || path.join(process.cwd(), 'sessions');
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const sessionPath = path.join(sessionRoot, safeId);

  debug.sessionFiles.path = sessionPath;

  try {
    if (fs.existsSync(sessionPath)) {
      debug.sessionFiles.exists = true;
      debug.sessionFiles.files = fs.readdirSync(sessionPath);

      if (debug.sessionFiles.files.length > 0) {
        debug.recommendations.push('Session files exist. WhatsApp should remember previous pairing.');
      }
    } else {
      debug.sessionFiles.exists = false;
      debug.recommendations.push('No session files found. This is expected for first-time setup.');
    }
  } catch (error) {
    debug.sessionFiles.exists = false;
  }

  // Add general recommendations
  if (debug.authentication.authenticated &&
      debug.entitlement.hasActive &&
      !debug.whatsappService.exists) {
    debug.recommendations.push('✅ Ready to connect! Click the "Connect / refresh QR" button in the dashboard.');
  }

  if (debug.whatsappService.exists &&
      !debug.whatsappService.connected &&
      debug.whatsappService.hasQr) {
    debug.recommendations.push('✅ QR code is ready! Scan it with WhatsApp app on your phone.');
  }

  return NextResponse.json(debug, { status: 200 });
}
