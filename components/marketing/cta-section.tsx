import Link from 'next/link';

export function CtaSection() {
  return (
    <section className="section cta-section" aria-labelledby="cta-heading">
      <div className="section-inner">
        <div className="cta-card">
          <div className="cta-copy">
            <h2 id="cta-heading" className="cta-title">
              Ready to connect WhatsApp?
            </h2>
            <p className="cta-desc">
              Create an account, pick a plan, and open the dashboard to scan your QR code. Your API credentials follow
              once you are entitled.
            </p>
          </div>
          <div className="cta-actions">
            <Link href="/register" className="button button-lg">
              Get started
            </Link>
            <Link href="/login" className="button button-lg button-ghost">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
