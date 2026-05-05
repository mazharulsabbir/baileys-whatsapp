import type { Metadata } from 'next';
import Link from 'next/link';
import { PRODUCT_NAME } from '@/lib/brand';
import { CustomersSection } from '@/components/marketing/customers-section';
import { CtaSection } from '@/components/marketing/cta-section';

export const metadata: Metadata = {
  title: 'Customers',
  description: `Teams using WhatsApp automation with ${PRODUCT_NAME} — retail, logistics, healthcare, and more.`,
};

export default function CustomersPage() {
  return (
    <>
      <div className="page-shell marketing-subpage">
        <p className="eyebrow">Social proof</p>
        <h1 className="section-title">Teams that ship with us</h1>
        <p className="section-subtitle" style={{ marginBottom: '2rem', maxWidth: '52ch' }}>
          From storefronts to clinics, operators connect WhatsApp Web once and keep CRM workflows in sync — without
          handing credentials across agencies.
        </p>
        <Link href="/pricing" className="button button-lg">
          View pricing
        </Link>
      </div>
      <CustomersSection />
      <CtaSection />
    </>
  );
}
