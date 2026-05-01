import { rateLimit } from '@/lib/rate-limit';
import { finalizeSslPaymentFromGateway } from '@/lib/sslcommerz-finalize';

export const runtime = 'nodejs';

/**
 * SSLCommerz posts IPN as form fields. Respond with plain text `COMPLETE` on success.
 */
export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = rateLimit(`ssl-ipn:${ip}`, 120, 60_000);
  if (!rl.ok) {
    return new Response('INVALID', { status: 429 });
  }

  const storeId = process.env.SSLCOMMERZ_STORE_ID?.trim();
  const storePass = process.env.SSLCOMMERZ_STORE_PASSWORD?.trim();
  if (!storeId || !storePass) {
    return new Response('INVALID', { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return new Response('INVALID', { status: 400 });
  }

  const val_id = String(formData.get('val_id') ?? '');
  const tran_id = String(formData.get('tran_id') ?? '');

  if (!val_id || !tran_id) {
    return new Response('INVALID', { status: 400 });
  }

  const result = await finalizeSslPaymentFromGateway(tran_id, val_id);

  if (result.ok) {
    return new Response('COMPLETE', { status: 200 });
  }

  if (result.reason === 'missing_credentials') {
    return new Response('INVALID', { status: 503 });
  }

  return new Response('INVALID', { status: 400 });
}
