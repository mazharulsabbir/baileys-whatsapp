/**
 * SSLCommerz Easy Checkout (sandbox / live) helpers.
 * @see https://developer.sslcommerz.com/doc/v4/
 */

function apiBase(isLive: boolean): string {
  return isLive
    ? 'https://securepay.sslcommerz.com'
    : 'https://sandbox.sslcommerz.com';
}

export function getInitUrl(isLive: boolean): string {
  return `${apiBase(isLive)}/gwprocess/v4/api.php`;
}

export function getValidationUrl(isLive: boolean): string {
  return `${apiBase(isLive)}/validator/api/validationserverAPI.php`;
}

export type SessionInitBody = {
  store_id: string;
  store_passwd: string;
  total_amount: string;
  currency: string;
  tran_id: string;
  success_url: string;
  fail_url: string;
  cancel_url: string;
  ipn_url: string;
  cus_name: string;
  cus_email: string;
  cus_phone?: string;
  product_name: string;
  product_category: string;
  product_profile: string;
  shipping_method?: string;
  value_a?: string;
  value_b?: string;
};

function toFormBody(body: SessionInitBody): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null || value === '') continue;
    params.append(key, String(value));
  }
  return params.toString();
}

/**
 * Start Easy Checkout session.
 * SSLCommerz expects `application/x-www-form-urlencoded`; JSON is often ignored (empty store_id).
 */
export async function initiateSession(
  isLive: boolean,
  body: SessionInitBody
): Promise<{ status: string; GatewayPageURL?: string; failedreason?: string }> {
  const res = await fetch(getInitUrl(isLive), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body: toFormBody(body),
  });

  const text = await res.text();
  let data: { status?: string; GatewayPageURL?: string; failedreason?: string };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    return {
      status: 'PARSE_ERROR',
      failedreason: text.slice(0, 500) || 'Non-JSON response from SSLCommerz',
    };
  }

  return {
    status: data.status ?? 'UNKNOWN',
    GatewayPageURL: data.GatewayPageURL,
    failedreason: data.failedreason,
  };
}

export async function validatePayment(
  isLive: boolean,
  params: { val_id: string; store_id: string; store_passwd: string }
): Promise<Record<string, unknown>> {
  const url = new URL(getValidationUrl(isLive));
  url.searchParams.set('val_id', params.val_id);
  url.searchParams.set('store_id', params.store_id);
  url.searchParams.set('store_passwd', params.store_passwd);
  url.searchParams.set('format', 'json');

  const res = await fetch(url.toString(), { method: 'GET' });
  return (await res.json()) as Record<string, unknown>;
}
