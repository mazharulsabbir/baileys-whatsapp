import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { grantSubscription } from '@/lib/entitlement-grant';
import { prisma } from '@/lib/prisma';
import { getPlan } from '@/lib/plans';
import { initiateSession } from '@/lib/sslcommerz';

export const runtime = 'nodejs';

const bodySchema = z.object({
  planSlug: z.string().min(1),
});

function gatewayMissingResponse() {
  const missing: string[] = [];
  const sid = process.env.SSLCOMMERZ_STORE_ID?.trim();
  const spw = process.env.SSLCOMMERZ_STORE_PASSWORD?.trim();
  if (!sid) missing.push('SSLCOMMERZ_STORE_ID');
  if (!spw) missing.push('SSLCOMMERZ_STORE_PASSWORD');

  return NextResponse.json(
    {
      error: 'Payment gateway not configured',
      missing,
      hint:
        'Add SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD to .env (create a sandbox store at https://developer.sslcommerz.com/). Restart the app after saving. For local UI testing only: npm run dev with DEV_SKIP_SSLCOMMERZ=true (development builds only).',
    },
    { status: 503 }
  );
}

/** Local testing without merchant credentials; disabled when NODE_ENV is production. */
function allowDevMockCheckout(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.DEV_SKIP_SSLCOMMERZ === 'true';
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  const plan = getPlan(parsed.data.planSlug);
  if (!plan) {
    return NextResponse.json({ error: 'Unknown plan' }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const storeId = process.env.SSLCOMMERZ_STORE_ID?.trim();
  const storePass = process.env.SSLCOMMERZ_STORE_PASSWORD?.trim();

  if ((!storeId || !storePass) && allowDevMockCheckout()) {
    const tran_id = `dev_${session.user.id}_${Date.now()}`;
    await prisma.payment.create({
      data: {
        userId: session.user.id,
        tranId: tran_id,
        amount: plan.amount,
        currency: plan.currency,
        status: 'validated',
        planSlug: plan.slug,
        rawPayload: { mock: true, devSkipSslcommerz: true },
      },
    });
    await grantSubscription(session.user.id, plan.slug);
    return NextResponse.json({ url: `${baseUrl}/payment/success`, mock: true });
  }

  if (!storeId || !storePass) {
    return gatewayMissingResponse();
  }
  const tran_id = `${session.user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  await prisma.payment.create({
    data: {
      userId: session.user.id,
      tranId: tran_id,
      amount: plan.amount,
      currency: plan.currency,
      status: 'pending',
      planSlug: plan.slug,
    },
  });

  const isLive = process.env.SSLCOMMERZ_IS_LIVE === 'true';

  const result = await initiateSession(isLive, {
    store_id: storeId,
    store_passwd: storePass,
    total_amount: plan.amount,
    currency: plan.currency,
    tran_id,
    success_url: `${baseUrl}/api/payments/sslcommerz/success`,
    fail_url: `${baseUrl}/payment/fail`,
    cancel_url: `${baseUrl}/pricing`,
    ipn_url: `${baseUrl}/api/payments/sslcommerz/ipn`,
    cus_name: session.user?.name ?? 'Customer',
    cus_email: session.user?.email ?? 'customer@example.com',
    cus_phone: '01700000000',
    product_name: `${plan.name} subscription`,
    product_category: 'subscription',
    product_profile: 'general',
    shipping_method: 'NO',
    value_a: plan.slug,
    value_b: session.user.id,
  });

  const ok =
    (result.status?.toUpperCase() === 'SUCCESS' || result.status === 'SUCCESS') &&
    result.GatewayPageURL;

  if (!ok || !result.GatewayPageURL) {
    await prisma.payment.deleteMany({ where: { tranId: tran_id } }).catch(() => {});
    return NextResponse.json(
      { error: result.failedreason ?? 'Could not start SSLCommerz session' },
      { status: 502 }
    );
  }

  return NextResponse.json({ url: result.GatewayPageURL });
}
