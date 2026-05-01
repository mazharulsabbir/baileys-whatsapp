import type { Metadata } from 'next';
import Link from 'next/link';
import { ReviewsSection } from '@/components/marketing/reviews-section';
import { CtaSection } from '@/components/marketing/cta-section';

export const metadata: Metadata = {
  title: 'Reviews',
  description: 'What operators say about Baileys SaaS — QR onboarding, SSLCommerz billing, and integration APIs.',
};

export default function ReviewsPage() {
  return (
    <>
      <div className="page-shell marketing-subpage">
        <p className="eyebrow">Testimonials</p>
        <h1 className="section-title">Reviews from the field</h1>
        <p className="section-subtitle" style={{ marginBottom: '2rem', maxWidth: '52ch' }}>
          Real feedback on switching from brittle scripts to hosted WhatsApp Web with billing and REST APIs in one stack.
        </p>
        <Link href="/register" className="button button-lg">
          Create account
        </Link>
      </div>
      <ReviewsSection />
      <CtaSection />
    </>
  );
}
