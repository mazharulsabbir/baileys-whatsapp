import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import { readWaMediaArtifact } from '@/lib/wa-media-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public fetch for Odoo `url` field on inbound media (unguessable artifact id).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ artifactId: string }> }
): Promise<Response> {
  const { artifactId } = await ctx.params;
  const meta = await readWaMediaArtifact(artifactId);
  if (!meta) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const buf = await fs.readFile(meta.diskPath);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': meta.mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(meta.fileName)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
