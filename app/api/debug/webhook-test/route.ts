import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { postAcuxPayloadWithRetries } from '@/lib/odoo-webhook-delivery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Debug endpoint to test webhook connectivity
 * POST /api/debug/webhook-test
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  const debug: Record<string, any> = {
    timestamp: new Date().toISOString(),
    userId,
    webhookConfig: null,
    networkTest: {
      attempted: false,
      reachable: false,
      error: null as string | null,
      responseTime: null as number | null
    },
    webhookTest: {
      attempted: false,
      success: false,
      status: null as number | null,
      error: null as string | null,
      responseTime: null as number | null
    },
    recommendations: [] as string[]
  };

  // 1. Check webhook configuration
  const credential = await prisma.odooGatewayCredential.findUnique({
    where: { userId },
    select: {
      connectorUuid: true,
      odooWebhookUrl: true,
      configSetInfo: true,
      updatedAt: true
    }
  });

  if (!credential) {
    debug.recommendations.push('No Odoo gateway credential found. Generate one from the dashboard.');
    return NextResponse.json(debug, { status: 200 });
  }

  debug.webhookConfig = {
    hasUrl: !!credential.odooWebhookUrl,
    url: credential.odooWebhookUrl || null,
    uuid: credential.connectorUuid,
    lastConfigSetAt: credential.updatedAt,
    configInfo: credential.configSetInfo
  };

  if (!credential.odooWebhookUrl) {
    debug.recommendations.push('Webhook URL not set. Odoo must call config_set action first.');
    debug.recommendations.push('In Odoo: ChatRoom → Configuration → Connectors → Click "Test Connection" or "Refresh Status"');
    return NextResponse.json(debug, { status: 200 });
  }

  const webhookUrl = credential.odooWebhookUrl;

  // 2. Test network connectivity to webhook URL
  try {
    debug.networkTest.attempted = true;
    const startTime = Date.now();

    // Try a simple fetch without authentication
    const response = await fetch(webhookUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    }).catch(async (headError) => {
      // If HEAD fails, try GET (some servers don't support HEAD)
      return await fetch(webhookUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
    });

    debug.networkTest.responseTime = Date.now() - startTime;
    debug.networkTest.reachable = true;
    debug.networkTest.status = response.status;

    if (response.status === 404) {
      debug.recommendations.push('Webhook endpoint returns 404. Check that Odoo WhatsApp Connector module is installed.');
      debug.recommendations.push(`Expected endpoint: ${webhookUrl}`);
    } else if (response.status >= 500) {
      debug.recommendations.push('Webhook endpoint returns server error. Check Odoo logs.');
    }
  } catch (error) {
    debug.networkTest.error = error instanceof Error ? error.message : String(error);
    debug.networkTest.reachable = false;

    if (debug.networkTest.error.includes('ECONNREFUSED')) {
      debug.recommendations.push('Connection refused. Odoo server is not reachable at this URL.');
      debug.recommendations.push('If using Docker: Odoo might be on a different network or localhost is not accessible.');
      debug.recommendations.push('Solution: Use Odoo\'s external/public URL or Docker service name.');
    } else if (debug.networkTest.error.includes('ETIMEDOUT')) {
      debug.recommendations.push('Connection timeout. Odoo server is not responding.');
    } else if (debug.networkTest.error.includes('ENOTFOUND')) {
      debug.recommendations.push('DNS resolution failed. Check the hostname in webhook URL.');
    }
  }

  // 3. Test actual webhook POST
  try {
    debug.webhookTest.attempted = true;
    const startTime = Date.now();

    const testPayload = {
      messages: [],
      events: [{
        type: 'test',
        message: 'Webhook connectivity test',
        timestamp: new Date().toISOString()
      }],
      updates: []
    };

    const result = await postAcuxPayloadWithRetries(webhookUrl, testPayload);

    debug.webhookTest.responseTime = Date.now() - startTime;
    debug.webhookTest.success = result.ok;
    debug.webhookTest.status = result.status || null;
    debug.webhookTest.error = result.error || null;

    if (result.ok) {
      debug.recommendations.push('✅ Webhook is working! Test message delivered successfully.');
    } else {
      debug.recommendations.push(`❌ Webhook delivery failed: ${result.error}`);

      if (result.status === 401 || result.status === 403) {
        debug.recommendations.push('Authentication failed. Check connector UUID matches in Odoo.');
      } else if (result.status === 404) {
        debug.recommendations.push('Endpoint not found. Verify WhatsApp Connector module is installed in Odoo.');
      }
    }
  } catch (error) {
    debug.webhookTest.error = error instanceof Error ? error.message : String(error);
    debug.recommendations.push(`Webhook test exception: ${debug.webhookTest.error}`);
  }

  // 4. Check dead letter queue
  const dlqCount = await prisma.odooWebhookDeadLetter.count({
    where: {
      userId,
      resolvedAt: null
    }
  });

  if (dlqCount > 0) {
    debug.recommendations.push(`⚠️ ${dlqCount} failed webhooks in dead letter queue. Check /api/integration/odoo-dlq`);
  }

  // 5. General recommendations
  if (webhookUrl.includes('localhost') || webhookUrl.includes('127.0.0.1')) {
    debug.recommendations.push('⚠️ Webhook URL uses localhost. This may not work from Docker containers.');
    debug.recommendations.push('Recommendation: Use host.docker.internal (Docker Desktop) or the host IP address.');
    debug.recommendations.push('Or: Use Odoo\'s external/public URL accessible from the internet.');
  }

  return NextResponse.json(debug, { status: 200 });
}
