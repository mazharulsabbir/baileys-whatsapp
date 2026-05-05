'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { formatApiQuotaLabel, PLANS } from '@/lib/plans';

export default function PricingPage() {
  const { data: session, status } = useSession();
  const [checkingOutSlug, setCheckingOutSlug] = useState<string | null>(null);

  async function checkout(planSlug: string) {
    if (status !== 'authenticated') {
      window.location.href = '/login';
      return;
    }
    setCheckingOutSlug(planSlug);
    try {
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
    } finally {
      setCheckingOutSlug(null);
    }
  }

  const planList = Object.values(PLANS);

  return (
    <div className="pricing-page">
      <div className="pricing-page-bg" aria-hidden />

      <div className="page-shell pricing-page-inner">
        <header className="pricing-hero">
          <div className="pricing-hero-orbs" aria-hidden />
          <p className="pricing-eyebrow">Billing</p>
          <h1>Plans that unlock the stack</h1>
          <p className="pricing-lead">
            Pay with <strong>SSLCommerz</strong> in BDT. Each tier includes a <strong>monthly API call budget</strong>{' '}
            (UTC calendar month) on top of your paid-through date — entitlement applies automatically via IPN.
          </p>
          <div className="pricing-trust-strip">
            <span className="pricing-trust-pill">
              <span className="pricing-trust-dot" aria-hidden />
              Bangladesh checkout
            </span>
            <span className="pricing-trust-pill">JWT + tenant isolation</span>
            <span className="pricing-trust-pill">Webhook-friendly</span>
          </div>
        </header>

        <div className="plans-grid">
          {planList.map((plan) => {
            const busy = checkingOutSlug === plan.slug;
            return (
              <article
                key={plan.slug}
                className={plan.featured ? 'plan-card plan-card-featured' : 'plan-card'}
              >
                <div className="plan-card-bg" aria-hidden />
                <div className="plan-card-top">
                  {plan.featured && (
                    <span className="plan-badge">
                      <span className="plan-badge-glow" aria-hidden />
                      Most popular
                    </span>
                  )}
                  <div className="plan-icon" aria-hidden>
                    {plan.featured ? (
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.9-6.3 4.9 2.3-7-6-4.6h7.6L12 2z" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <h2 className="plan-name">{plan.name}</h2>
                  <p className="plan-tagline">{plan.tagline}</p>
                  <p className="plan-desc">{plan.description}</p>
                </div>

                <div className="plan-price-block">
                  <p className="plan-price">
                    <span className="plan-currency">৳</span>
                    {plan.amount}
                  </p>
                  <p className="plan-billing">
                    {formatApiQuotaLabel(plan.monthlyApiQuota)} · {plan.durationDays}-day access window ({plan.currency})
                  </p>
                </div>

                <ul className="plan-features" aria-label={`${plan.name} includes`}>
                  {plan.features.map((line) => (
                    <li key={line}>
                      <span className="plan-feature-icon" aria-hidden>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>

                <div className="plan-cta-wrap">
                  <button
                    type="button"
                    className={`button plan-cta button-lg${plan.featured ? '' : ' button-secondary plan-cta-secondary'}`}
                    onClick={() => void checkout(plan.slug)}
                    disabled={busy || status === 'loading'}
                    aria-busy={busy}
                  >
                    {busy ? 'Opening checkout…' : session ? 'Subscribe with SSLCommerz' : 'Log in to subscribe'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {!session && status !== 'loading' && (
          <div className="pricing-callout card">
            <p className="pricing-callout-text">
              New here?{' '}
              <Link href="/register" className="pricing-callout-link">
                Create a free account
              </Link>{' '}
              — then pick a plan. Already registered?{' '}
              <Link href="/login" className="pricing-callout-link">
                Sign in
              </Link>
              .
            </p>
          </div>
        )}

        <section className="pricing-faq-strip" aria-label="Billing notes">
          <h3 className="pricing-faq-title">How renewal works</h3>
          <ul className="pricing-faq-list">
            <li>After IPN, your dashboard shows plan tier, paid-through date, and live API usage against the UTC month.</li>
            <li>Tiers cap total integration API calls per month (messages + status); unlimited skips the cap.</li>
            <li>Reach 75% / 85% / 95% of quota — optional emails from Account (SMTP required on the server).</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
