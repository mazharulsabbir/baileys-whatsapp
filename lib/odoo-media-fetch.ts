/**
 * Fetch binary media from Odoo `chatresource` / static URLs for outbound WhatsApp sends.
 * Baileys downloads `{ url }` internally and runs Sharp for thumbnails; HTML login pages,
 * SVG, or odd encodings often fail with "unsupported image format". We fetch here, validate,
 * and normalize raster images to JPEG before handing a Buffer to Baileys.
 */

const DEFAULT_MAX_BYTES = 45 * 1024 * 1024;

function looksLikeHtml(buffer: Buffer): boolean {
  const head = buffer.subarray(0, Math.min(buffer.length, 256)).toString('utf8').trimStart().toLowerCase();
  return (
    head.startsWith('<!doctype') ||
    head.startsWith('<html') ||
    head.startsWith('<head') ||
    head.startsWith('<?xml')
  );
}

/**
 * Download URL (Odoo attachment / product image). Throws if not OK or body looks like HTML.
 */
export async function fetchOdooMediaBuffer(
  url: string,
  maxBytes: number = DEFAULT_MAX_BYTES
): Promise<Buffer> {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      Accept: '*/*',
      'User-Agent': 'Baileys-Odoo-Gateway/1.0',
    },
  });

  if (!res.ok) {
    throw new Error(`Media HTTP ${res.status} for ${truncateUrl(url)}`);
  }

  const lenHeader = res.headers.get('content-length');
  if (lenHeader) {
    const n = parseInt(lenHeader, 10);
    if (Number.isFinite(n) && n > maxBytes) {
      throw new Error(`Media too large (${n} bytes)`);
    }
  }

  const ab = await res.arrayBuffer();
  if (ab.byteLength > maxBytes) {
    throw new Error(`Media too large (${ab.byteLength} bytes)`);
  }

  const buf = Buffer.from(ab);
  if (looksLikeHtml(buf)) {
    throw new Error(
      'Media URL returned HTML instead of an image (wrong base URL, auth, or expired token). ' +
        `Check connector Odoo URL and that ${truncateUrl(url)} is reachable from this server.`
    );
  }

  return buf;
}

function truncateUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname.slice(0, 48)}…`;
  } catch {
    return url.slice(0, 80);
  }
}

/**
 * Re-encode to JPEG so Baileys/Sharp thumbnail pipeline accepts the payload.
 */
export async function rasterToJpegForWhatsApp(buffer: Buffer): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  return sharp(buffer).rotate().jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}
