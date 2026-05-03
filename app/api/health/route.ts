import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAllServices } from '@/lib/whatsapp-registry';

export const runtime = 'nodejs';

interface HealthCheckResponse {
  ok: boolean;
  timestamp: string;
  services: {
    database: 'up' | 'down';
    whatsapp: 'up' | 'degraded' | 'down';
  };
  details?: {
    activeConnections: number;
    totalTenants: number;
    uptime: number;
    version: string;
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const detailed = searchParams.get('detailed') === 'true' ||
                   process.env.HEALTH_CHECK_DETAILED === 'true';

  const health: HealthCheckResponse = {
    ok: true,
    timestamp: new Date().toISOString(),
    services: {
      database: 'down',
      whatsapp: 'down'
    }
  };

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = 'up';
  } catch (error) {
    health.ok = false;
    health.services.database = 'down';
  }

  // Check WhatsApp service status
  try {
    const services = getAllServices();
    const activeConnections = Array.from(services.values()).filter(
      svc => svc.isConnected()
    ).length;
    const totalTenants = services.size;

    if (totalTenants === 0) {
      // No tenants registered yet - service is operational but idle
      health.services.whatsapp = 'up';
    } else if (activeConnections === 0) {
      // Tenants exist but none connected - degraded state
      health.services.whatsapp = 'degraded';
      health.ok = false;
    } else if (activeConnections < totalTenants * 0.5) {
      // Less than 50% connected - degraded
      health.services.whatsapp = 'degraded';
    } else {
      // Healthy state
      health.services.whatsapp = 'up';
    }

    if (detailed) {
      health.details = {
        activeConnections,
        totalTenants,
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
      };
    }
  } catch (error) {
    health.services.whatsapp = 'down';
    health.ok = false;
  }

  const statusCode = health.ok ? 200 : 503;
  return NextResponse.json(health, { status: statusCode });
}
