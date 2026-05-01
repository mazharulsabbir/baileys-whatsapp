import { prisma } from '@/lib/prisma';
import { getPlan } from '@/lib/plans';
import { validatePayment } from '@/lib/sslcommerz';

/** SSLCommerz redirect + validation API use `VALID` or `VALIDATED`; failures use `INVALID`, `FAILED`, etc. */
function isSslcommerzPaidStatus(status: unknown): boolean {
  const s = String(status ?? '').trim().toUpperCase();
  if (!s || s.includes('INVALID')) return false;
  if (s.includes('VALIDATED')) return true;
  if (s === 'VALID') return true;
  return false;
}

export type FinalizeResult =
  | { ok: true; alreadyValidated?: boolean }
  | { ok: false; reason: 'missing_credentials' | 'not_found' | 'validation_failed' };

/**
 * Validates a transaction with SSLCommerz and grants entitlement.
 * Idempotent: repeated calls for an already-validated payment return ok.
 */
export async function finalizeSslPaymentFromGateway(
  tran_id: string,
  val_id: string
): Promise<FinalizeResult> {
  const storeId = process.env.SSLCOMMERZ_STORE_ID?.trim();
  const storePass = process.env.SSLCOMMERZ_STORE_PASSWORD?.trim();
  if (!storeId || !storePass) {
    return { ok: false, reason: 'missing_credentials' };
  }

  if (!tran_id || !val_id) {
    return { ok: false, reason: 'validation_failed' };
  }

  const payment = await prisma.payment.findUnique({
    where: { tranId: tran_id },
  });

  if (!payment) {
    return { ok: false, reason: 'not_found' };
  }

  if (payment.status === 'validated') {
    return { ok: true, alreadyValidated: true };
  }

  const isLive = process.env.SSLCOMMERZ_IS_LIVE === 'true';
  const val = await validatePayment(isLive, {
    val_id,
    store_id: storeId,
    store_passwd: storePass,
  });

  const valAmt = parseFloat(String(val.amount ?? '').replace(/,/g, ''));
  const payAmt = parseFloat(String(payment.amount ?? '').replace(/,/g, ''));
  const amountOk =
    Number.isFinite(valAmt) && Number.isFinite(payAmt) && Math.abs(valAmt - payAmt) < 0.01;
  const tranOk = String(val.tran_id ?? tran_id).trim() === tran_id.trim();

  const validatedOk = isSslcommerzPaidStatus(val.status);

  if (!validatedOk || !tranOk || !amountOk) {
    await prisma.payment
      .update({
        where: { tranId: tran_id },
        data: { status: 'failed', rawPayload: val as object },
      })
      .catch(() => {});
    return { ok: false, reason: 'validation_failed' };
  }

  const planSlug = payment.planSlug ?? 'starter';
  const plan = getPlan(planSlug);
  const days = plan?.durationDays ?? 30;
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + days);

  await prisma.$transaction([
    prisma.payment.update({
      where: { tranId: tran_id },
      data: {
        status: 'validated',
        valId: val_id,
        rawPayload: val as object,
      },
    }),
    prisma.entitlement.upsert({
      where: { userId: payment.userId },
      create: {
        userId: payment.userId,
        planSlug: plan?.slug ?? planSlug,
        status: 'active',
        validUntil,
      },
      update: {
        planSlug: plan?.slug ?? planSlug,
        status: 'active',
        validUntil,
      },
    }),
  ]);

  return { ok: true };
}
