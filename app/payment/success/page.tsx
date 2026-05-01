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
        ? 'Payment confirmation pending'
        : 'Payment received';

  const detail =
    sync === 'ok'
      ? 'Your plan is active. You can use the dashboard and APIs for this billing period.'
      : sync === 'error'
        ? 'We could not verify this payment automatically. If your dashboard still shows no plan after a few minutes, contact support with your transaction ID.'
        : 'If you just paid, your subscription is synced when you return from the gateway. You can open your dashboard to confirm.';

  return (
    <div className="page-shell">
      <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
        <h1>{headline}</h1>
        <p style={{ color: 'var(--muted)', marginTop: '0.5rem' }}>{detail}</p>
        <p style={{ marginTop: '1rem' }}>
          <Link href="/dashboard" className="button">
            Go to dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
