/**
 * Public HTTPS origin for URLs embedded in Odoo payloads (media downloads).
 */
export function getPublicAppOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  const u = raw.trim().replace(/\/$/, '');
  if (!u) return '';
  if (u.startsWith('http://') || u.startsWith('https://')) {
    return u;
  }
  return `https://${u}`;
}
