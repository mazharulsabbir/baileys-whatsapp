import { NextResponse } from 'next/server';
import { finalizeSslPaymentFromGateway } from '@/lib/sslcommerz-finalize';

export const runtime = 'nodejs';

function redirectToPaymentPage(req: Request, sync: 'ok' | 'error' | 'skip') {
  const base = new URL(req.url);
  const dest = new URL('/payment/success', base.origin);
  if (sync !== 'skip') dest.searchParams.set('sync', sync);
  return NextResponse.redirect(dest, 303);
}

async function readTranAndValId(req: Request): Promise<{ tran_id: string; val_id: string }> {
  const ct = req.headers.get('content-type') ?? '';

  if (ct.includes('multipart/form-data')) {
    const formData = await req.formData();
    return {
      tran_id: String(formData.get('tran_id') ?? ''),
      val_id: String(formData.get('val_id') ?? ''),
    };
  }

  /** SSLCommerz POSTs `application/x-www-form-urlencoded` (e.g. tran_id=…&val_id=…&status=VALID&…) */
  const raw = await req.text();
  const params = new URLSearchParams(raw);
  return {
    tran_id: params.get('tran_id') ?? '',
    val_id: params.get('val_id') ?? '',
  };
}

/**
 * SSLCommerz Easy Checkout POSTs form fields to `success_url` (not a GET to a static page).
 * This handler validates `val_id`, grants entitlement (same as IPN), then redirects to the UI.
 */
export async function POST(req: Request) {
  let tran_id = '';
  let val_id = '';
  try {
    ({ tran_id, val_id } = await readTranAndValId(req));
  } catch {
    return redirectToPaymentPage(req, 'error');
  }

  if (!tran_id || !val_id) {
    return redirectToPaymentPage(req, 'error');
  }

  const result = await finalizeSslPaymentFromGateway(tran_id, val_id);
  if (result.ok) {
    return redirectToPaymentPage(req, 'ok');
  }
  return redirectToPaymentPage(req, 'error');
}

/** Fallback when the gateway uses GET with query parameters (some integrations / manual tests). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tran_id = url.searchParams.get('tran_id') ?? '';
  const val_id = url.searchParams.get('val_id') ?? '';
  if (!tran_id || !val_id) {
    return redirectToPaymentPage(req, 'skip');
  }

  const result = await finalizeSslPaymentFromGateway(tran_id, val_id);
  if (result.ok) {
    return redirectToPaymentPage(req, 'ok');
  }
  return redirectToPaymentPage(req, 'error');
}
