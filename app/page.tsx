import type { Metadata } from 'next';
import { PRODUCT_NAME } from '@/lib/brand';
import { Hero } from '@/components/marketing/hero';
import { StatsStrip } from '@/components/marketing/stats-strip';
import { FeaturesSection } from '@/components/marketing/features-section';
import { CustomersSection } from '@/components/marketing/customers-section';
import { ReviewsSection } from '@/components/marketing/reviews-section';
import { FaqSection } from '@/components/marketing/faq-section';
import { CtaSection } from '@/components/marketing/cta-section';

export const metadata: Metadata = {
  title: 'WhatsApp automation for teams',
  description: `${PRODUCT_NAME} — connect WhatsApp Web from your dashboard, bill with SSLCommerz (BDT), and integrate via quota-aware REST APIs.`,
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
