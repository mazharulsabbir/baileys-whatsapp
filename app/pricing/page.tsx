'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { PLANS } from '@/lib/plans';

export default function PricingPage() {
  const { data: session, status } = useSession();

  async function checkout(planSlug: string) {
    if (status !== 'authenticated') {
      window.location.href = '/login';
      return;
    }
    const res = await fetch('/api/payments/sslcommerz/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planSlug }),
    });
    const data = (await res.json()) as {
      url?: string;
      error?: string;
      hint?: string;
      missing?: string[];
    };
    if (!res.ok) {
      const detail = [data.error, data.hint, data.missing?.length ? `Missing: ${data.missing.join(', ')}` : '']
        .filter(Boolean)
        .join('\n\n');
      alert(detail || 'Could not start checkout');
      return;
    }
    if (data.url) {
      window.location.href = data.url;
    }
  }

  const planList = Object.values(PLANS);

  return (
    <div className="page-shell">
      <div className="pricing-hero">
        <h1>Simple pricing</h1>
        <p>
          Pay with SSLCommerz (BDT). Your subscription activates when you return from checkout (and via IPN backup) — no
          manual license keys.
        </p>
      </div>

      <div className="plans-grid">
        {planList.map((plan) => {
          const featured = plan.slug === 'pro';
          return (
            <div key={plan.slug} className={`plan-card${featured ? ' featured' : ''}`}>
              {featured && <span className="plan-badge">Most popular</span>}
              <h2 className="plan-name">{plan.name}</h2>
              <p className="plan-desc">{plan.description}</p>
              <p className="plan-price">
                ৳{plan.amount}{' '}
                <span>/ {plan.durationDays} days</span>
              </p>
              <button type="button" className="button" onClick={() => checkout(plan.slug)}>
                {session ? 'Subscribe' : 'Login to subscribe'}
              </button>
            </div>
          );
        })}
      </div>

      {!session && (
        <p className="pricing-footnote">
          <Link href="/register">Create an account</Link> to purchase a plan.
        </p>
      )}
    </div>
  );
}
