import Link from 'next/link';
import { PRODUCT_NAME } from '@/lib/brand';

const year = new Date().getFullYear();

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="section-inner footer-grid">
        <div className="footer-brand">
          <Link href="/" className="footer-logo">
            <span className="footer-logo-mark" aria-hidden />
            {PRODUCT_NAME}
          </Link>
          <p className="footer-tagline">
            WhatsApp Web connectivity, metered REST APIs, and SSLCommerz billing — multi-tenant, production-focused.
          </p>
        </div>
        <div className="footer-col">
          <h3 className="footer-heading">Product</h3>
          <ul className="footer-links">
            <li>
              <Link href="/#features">Features</Link>
            </li>
            <li>
              <Link href="/pricing">Pricing</Link>
            </li>
            <li>
              <Link href="/#reviews">Reviews</Link>
            </li>
            <li>
              <Link href="/#faq">FAQ</Link>
            </li>
            <li>
              <Link href="/dashboard">Dashboard</Link>
            </li>
          </ul>
        </div>
        <div className="footer-col">
          <h3 className="footer-heading">Company</h3>
          <ul className="footer-links">
            <li>
              <Link href="/#customers">Customers</Link>
            </li>
            <li>
              <a href="mailto:support@example.com">Contact</a>
            </li>
          </ul>
        </div>
        <div className="footer-col">
          <h3 className="footer-heading">Legal</h3>
          <ul className="footer-links">
            <li>
              <Link href="/pricing">Billing</Link>
            </li>
            <li>
              <span className="footer-note">Use subject to WhatsApp Terms</span>
            </li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom section-inner">
        <p className="footer-copy">© {year} {PRODUCT_NAME}. All rights reserved.</p>
        <div className="footer-social" aria-label="Social links">
          <a
            href="https://github.com/WhiskeySockets/Baileys"
            target="_blank"
            rel="noreferrer noopener"
            className="social-link"
            aria-label="WhatsApp Web engine library on GitHub"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.114 2.504.336 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.699 1.028 1.59 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
