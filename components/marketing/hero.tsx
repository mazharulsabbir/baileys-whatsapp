import Link from 'next/link';

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-heading">
      <div className="hero-bg" aria-hidden />
      <div className="section-inner hero-inner">
        <p className="eyebrow">WhatsApp automation for teams</p>
        <h1 id="hero-heading" className="hero-title">
          Production-ready WhatsApp SaaS on Baileys
        </h1>
        <p className="hero-lead">
          Register, pay with SSLCommerz, and connect WhatsApp Web from your dashboard — with tenant isolation and an API
          your integrations can trust.
        </p>
        <div className="hero-actions">
          <Link href="/register" className="button button-lg">
            Start free setup
          </Link>
          <Link href="/pricing" className="button button-lg button-secondary">
            See pricing
          </Link>
        </div>
        <ul className="hero-points">
          <li>BDT checkout via SSLCommerz</li>
          <li>Dashboard QR session control</li>
          <li>Scoped REST credentials</li>
        </ul>
      </div>
    </section>
  );
}
