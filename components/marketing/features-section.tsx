import { FEATURES } from '@/lib/marketing-content';
import { FeatureIcon } from './feature-icon';

export function FeaturesSection() {
  return (
    <section id="features" className="section section-alt" aria-labelledby="features-heading">
      <div className="section-inner">
        <div className="section-header">
          <p className="eyebrow">Platform</p>
          <h2 id="features-heading" className="section-title">
            Built for real deployments
          </h2>
          <p className="section-subtitle">
            Everything you need to offer WhatsApp connectivity as a product — not just a weekend script.
          </p>
        </div>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className="feature-card">
              <div className="feature-icon-wrap" aria-hidden>
                <FeatureIcon name={f.icon} />
              </div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
