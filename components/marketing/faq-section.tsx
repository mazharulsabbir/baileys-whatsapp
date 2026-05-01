import { FAQ } from '@/lib/marketing-content';

export function FaqSection() {
  return (
    <section id="faq" className="section" aria-labelledby="faq-heading">
      <div className="section-inner">
        <div className="section-header">
          <p className="eyebrow">FAQ</p>
          <h2 id="faq-heading" className="section-title">
            Answers before you subscribe
          </h2>
          <p className="section-subtitle">
            Straightforward notes on billing, integrations, and how this differs from Meta-hosted APIs.
          </p>
        </div>
        <div className="faq-list">
          {FAQ.map((item) => (
            <details key={item.q} className="faq-item">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
