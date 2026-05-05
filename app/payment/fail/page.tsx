import Link from 'next/link';

export default function PaymentFailPage() {
  return (
    <div className="pricing-page billing-result-page">
      <div className="pricing-page-bg" aria-hidden />

      <div className="page-shell billing-result-inner">
        <div className="billing-result-card">
          <div className="billing-result-icon billing-result-icon-warn" aria-hidden>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <p className="billing-result-eyebrow">Checkout</p>
          <h1 className="billing-result-title">Payment didn&apos;t complete</h1>
          <p className="billing-result-body">
            The gateway canceled or declined this attempt. Nothing was charged — you can pick a plan again whenever
            you&apos;re ready.
          </p>
          <div className="billing-result-actions">
            <Link href="/pricing" className="button button-lg">
              Try pricing again
            </Link>
            <Link href="/dashboard" className="button button-lg button-secondary">
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
