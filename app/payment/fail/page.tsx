import Link from 'next/link';

export default function PaymentFailPage() {
  return (
    <div className="page-shell">
    <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
      <h1>Payment failed or cancelled</h1>
      <p style={{ color: 'var(--muted)', marginTop: '0.5rem' }}>
        You can return to pricing and try again.
      </p>
      <p style={{ marginTop: '1rem' }}>
        <Link href="/pricing" className="button">
          Back to pricing
        </Link>
      </p>
    </div>
    </div>
  );
}
