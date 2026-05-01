import { REVIEWS } from '@/lib/marketing-content';

function Stars({ rating }: { rating: number }) {
  const label = `${rating} out of 5 stars`;
  return (
    <div className="stars" role="img" aria-label={label}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < rating ? 'star on' : 'star'} aria-hidden>
          ★
        </span>
      ))}
    </div>
  );
}

export function ReviewsSection() {
  return (
    <section id="reviews" className="section section-alt" aria-labelledby="reviews-heading">
      <div className="section-inner">
        <div className="section-header">
          <p className="eyebrow">Reviews</p>
          <h2 id="reviews-heading" className="section-title">
            What customers say
          </h2>
          <p className="section-subtitle">
            Authentic feedback from teams who needed reliability, billing, and integration in one package.
          </p>
        </div>
        <div className="reviews-grid">
          {REVIEWS.map((r) => (
            <blockquote key={r.author} className="review-card">
              <Stars rating={r.rating} />
              <p className="review-quote">&ldquo;{r.quote}&rdquo;</p>
              <footer className="review-footer">
                <cite className="review-author">{r.author}</cite>
                <span className="review-meta">
                  {r.role}, {r.company}
                </span>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
