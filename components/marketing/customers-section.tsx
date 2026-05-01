import { CUSTOMERS } from '@/lib/marketing-content';

export function CustomersSection() {
  return (
    <section id="customers" className="section" aria-labelledby="customers-heading">
      <div className="section-inner">
        <div className="section-header section-header-center">
          <p className="eyebrow">Trusted</p>
          <h2 id="customers-heading" className="section-title">
            Teams shipping with confidence
          </h2>
          <p className="section-subtitle">
            From logistics to clinics — organizations use this stack to keep WhatsApp next to their operations stack.
          </p>
        </div>
        <div className="customer-marquee" role="list">
          {CUSTOMERS.map((c) => (
            <div key={c.name} className="customer-pill" role="listitem">
              <span className="customer-name">{c.name}</span>
              <span className="customer-sector">{c.sector}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
