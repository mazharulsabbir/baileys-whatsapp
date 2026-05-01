type IconName = 'link' | 'card' | 'api' | 'layers' | 'gauge' | 'puzzle';

const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function FeatureIcon({ name }: { name: IconName }) {
  switch (name) {
    case 'link':
      return (
        <svg {...common} aria-hidden>
          <path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1" />
          <path d="M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 1 1-7-7l1-1" />
        </svg>
      );
    case 'card':
      return (
        <svg {...common} aria-hidden>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      );
    case 'api':
      return (
        <svg {...common} aria-hidden>
          <path d="M4 10h4l2-6 4 12 2-6h4" />
        </svg>
      );
    case 'layers':
      return (
        <svg {...common} aria-hidden>
          <path d="m12.83 2.18 7.64 4.43a1 1 0 0 1 0 1.73l-7.64 4.43a2 2 0 0 1-2 0L3.18 8.34a1 1 0 0 1 0-1.73l7.64-4.43a2 2 0 0 1 2 0z" />
          <path d="M3.18 12.66 12 17.5l8.82-4.84" />
          <path d="M3.18 16.66 12 21.5l8.82-4.84" />
        </svg>
      );
    case 'gauge':
      return (
        <svg {...common} aria-hidden>
          <path d="M12 14v2" />
          <path d="M8.5 10.5 12 14l3.5-3.5" />
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
    case 'puzzle':
      return (
        <svg {...common} aria-hidden>
          <path d="M12 2v4a2 2 0 0 0 2 2h4a2 2 0 0 1 2 2v4h-4a2 2 0 0 0-2 2v4" />
          <path d="M12 22v-4a2 2 0 0 1-2-2H6a2 2 0 0 1-2-2v-4h4a2 2 0 0 0 2-2V4" />
        </svg>
      );
    default:
      return null;
  }
}
