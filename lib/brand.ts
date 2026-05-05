/**
 * Customer-facing product identity (nav, SEO, emails).
 * Set `NEXT_PUBLIC_APP_NAME` to white-label the deployment.
 */
export const PRODUCT_NAME =
  typeof process.env.NEXT_PUBLIC_APP_NAME === 'string' && process.env.NEXT_PUBLIC_APP_NAME.trim() !== ''
    ? process.env.NEXT_PUBLIC_APP_NAME.trim()
    : 'RelayLink';
