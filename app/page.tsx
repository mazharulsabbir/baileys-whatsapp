import type { Metadata } from 'next';
import { Hero } from '@/components/marketing/hero';
import { StatsStrip } from '@/components/marketing/stats-strip';
import { FeaturesSection } from '@/components/marketing/features-section';
import { CustomersSection } from '@/components/marketing/customers-section';
import { ReviewsSection } from '@/components/marketing/reviews-section';
import { FaqSection } from '@/components/marketing/faq-section';
import { CtaSection } from '@/components/marketing/cta-section';

export const metadata: Metadata = {
  title: 'WhatsApp automation for teams',
  description:
    'Connect WhatsApp Web from your dashboard, subscribe with SSLCommerz, and integrate via REST — multi-tenant ready.',
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <StatsStrip />
      <FeaturesSection />
      <CustomersSection />
      <ReviewsSection />
      <FaqSection />
      <CtaSection />
    </>
  );
}
