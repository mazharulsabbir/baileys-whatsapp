import { STATS } from '@/lib/marketing-content';

export function StatsStrip() {
  return (
    <section className="stats-strip" aria-label="Product highlights">
      <div className="section-inner stats-inner">
        {STATS.map((s) => (
          <div key={s.label} className="stat-item">
            <p className="stat-value">{s.value}</p>
            <p className="stat-label">{s.label}</p>
            <p className="stat-hint">{s.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
