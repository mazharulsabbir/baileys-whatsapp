import Link from 'next/link';
import { auth } from '@/auth';
import { SignOutButton } from './sign-out-button';

export async function Nav() {
  const session = await auth();

  if (session) {
    return (
      <header className="site-header site-header-app">
        <div className="section-inner nav-inner">
          <Link href="/dashboard" className="nav-brand">
            <span className="nav-logo-mark" aria-hidden />
            <span>Baileys SaaS</span>
          </Link>

          <nav className="nav-desktop nav-desktop-app" aria-label="App">
            <Link href="/dashboard" className="nav-link-pill">
              Overview
            </Link>
            <Link href="/pricing" className="nav-link-pill">
              Pricing
            </Link>
          </nav>

          <div className="nav-actions nav-actions-app">
            <span className="nav-user-email" title={session.user?.email ?? undefined}>
              {session.user?.email}
            </span>
            <SignOutButton />
          </div>

          <details className="nav-mobile">
            <summary className="nav-mobile-trigger">
              <span className="sr-only">Open menu</span>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </summary>
            <div className="nav-mobile-panel">
              <Link href="/dashboard">Overview</Link>
              <Link href="/pricing">Pricing</Link>
              <span className="nav-mobile-signout">
                <SignOutButton />
              </span>
            </div>
          </details>
        </div>
      </header>
    );
  }

  return (
    <header className="site-header">
      <div className="section-inner nav-inner">
        <Link href="/" className="nav-brand">
          <span className="nav-logo-mark" aria-hidden />
          <span>Baileys SaaS</span>
        </Link>

        <nav className="nav-desktop" aria-label="Primary">
          <Link href="/#features">Features</Link>
          <Link href="/#customers">Customers</Link>
          <Link href="/#reviews">Reviews</Link>
          <Link href="/#faq">FAQ</Link>
          <Link href="/pricing">Pricing</Link>
        </nav>

        <div className="nav-actions">
          <Link href="/login" className="nav-text-link">
            Login
          </Link>
          <Link href="/register" className="button button-sm">
            Register
          </Link>
        </div>

        <details className="nav-mobile">
          <summary className="nav-mobile-trigger">
            <span className="sr-only">Open menu</span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </summary>
          <div className="nav-mobile-panel">
            <Link href="/#features">Features</Link>
            <Link href="/#customers">Customers</Link>
            <Link href="/#reviews">Reviews</Link>
            <Link href="/#faq">FAQ</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/login">Login</Link>
            <Link href="/register" className="button button-sm nav-mobile-cta">
              Register
            </Link>
          </div>
        </details>
      </div>
    </header>
  );
}
