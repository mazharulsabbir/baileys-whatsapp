import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasActiveEntitlement } from '@/lib/entitlement';
import {
  getCredentialPublic,
  rotateApiKey,
  updateWebhookSettings,
} from '@/lib/integration-credential';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const entitled = await hasActiveEntitlement(session.user.id);
  if (!entitled) {
    return NextResponse.json({ error: 'Active subscription required' }, { status: 403 });
  }

  const pub = await getCredentialPublic(session.user.id);
  return NextResponse.json(pub);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const entitled = await hasActiveEntitlement(session.user.id);
  if (!entitled) {
    return NextResponse.json({ error: 'Active subscription required' }, { status: 403 });
  }

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.action === 'rotateApiKey') {
    const { apiKey, apiKeyPrefix } = await rotateApiKey(session.user.id);
    return NextResponse.json({
      apiKey,
      apiKeyPrefix,
      warning: 'Save this API key now; it will not be shown again.',
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const entitled = await hasActiveEntitlement(session.user.id);
  if (!entitled) {
    return NextResponse.json({ error: 'Active subscription required' }, { status: 403 });
  }

  let body: {
    webhookUrl?: string | null;
    rotateWebhookSecret?: boolean;
    webhookSecret?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const extra = await updateWebhookSettings(session.user.id, {
      ...(body.webhookUrl !== undefined ? { webhookUrl: body.webhookUrl } : {}),
      rotateWebhookSecret: Boolean(body.rotateWebhookSecret),
      ...(body.webhookSecret !== undefined ? { webhookSecret: body.webhookSecret } : {}),
    });
    return NextResponse.json({
      ok: true,
      ...extra,
      message: extra.webhookSecret
        ? 'Save the webhook secret in Odoo; it is shown only this once.'
        : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Update failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
