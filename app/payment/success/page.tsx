import Link from 'next/link';

type Props = {
  searchParams?: Promise<{ sync?: string }>;
};

export default async function PaymentSuccessPage({ searchParams }: Props) {
  const sync = searchParams ? (await searchParams).sync : undefined;

  const headline =
    sync === 'ok'
      ? 'Subscription activated'
      : sync === 'error'
        ? 'Confirmation is still syncing'
        : 'Payment submitted';

  const detail =
    sync === 'ok'
      ? 'Your entitlement is active for this billing period. Open the console to pair WhatsApp and rotate API keys.'
      : sync === 'error'
        ? 'IPN verification had a hiccup. Wait a minute and refresh your dashboard — if nothing appears, reach out with your SSLCommerz tran_id.'
        : 'Gateway accepted the payment. We unlock your plan as soon as the callback lands; Dashboard shows the renewed dates within seconds.';

  const tone = sync === 'ok' ? 'ok' : sync === 'error' ? 'warn' : 'neutral';

  return (
    <div className={`pricing-page billing-result-page billing-result-${tone}`}>
      <div className="pricing-page-bg" aria-hidden />

      <div className="page-shell billing-result-inner">
        <div className="billing-result-card">
          <div
            className={`billing-result-icon ${
              tone === 'ok' ? 'billing-result-icon-ok' : tone === 'warn' ? 'billing-result-icon-warn' : 'billing-result-icon-neutral'
            }`}
            aria-hidden
          >
            {tone === 'ok' ? (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : tone === 'warn' ? (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
                <circle cx="12" cy="12" r="10" />
              </svg>
            ) : (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" strokeLinecap="round" />
                <circle cx="12" cy="12" r="4" />
              </svg>
            )}
          </div>
          <p className="billing-result-eyebrow">SSLCommerz</p>
          <h1 className="billing-result-title">{headline}</h1>
          <p className="billing-result-body">{detail}</p>
          <div className="billing-result-actions">
            <Link href="/dashboard" className="button button-lg">
              Open dashboard
            </Link>
            <Link href="/pricing" className="button button-lg button-secondary">
              View plans
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
