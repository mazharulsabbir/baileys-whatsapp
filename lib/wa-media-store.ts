import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getPublicAppOrigin } from '@/lib/app-public-origin';

const DEFAULT_MEDIA_SUBDIR = 'wa-media-cache';
const MAX_BYTES = 45 * 1024 * 1024;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function getWaMediaRoot(): string {
  const override = process.env.WHATSAPP_MEDIA_ROOT?.trim();
  if (override) return path.resolve(override);
  return path.join(process.cwd(), DEFAULT_MEDIA_SUBDIR);
}

function safeSegment(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';
}

export async function saveInboundMedia(args: {
  userId: string;
  buffer: Buffer;
  mimeType: string;
  suggestedFileName?: string;
}): Promise<{ artifactId: string; publicUrl: string } | null> {
  const origin = getPublicAppOrigin();
  if (!origin) {
    return null;
  }

  if (args.buffer.length > MAX_BYTES) {
    return null;
  }

  const artifactId = crypto.randomUUID();
  const ext =
    path.extname(args.suggestedFileName || '') ||
    guessExt(args.mimeType);
  const baseName = safeSegment(
    path.basename(args.suggestedFileName || 'media', ext) || 'media'
  );
  const fileName = `${baseName}${ext}`;

  const dir = path.join(getWaMediaRoot(), args.userId.replace(/[^a-zA-Z0-9_-]/g, '_'));
  await fs.mkdir(dir, { recursive: true });
  const diskPath = path.join(dir, `${artifactId}_${fileName}`);
  await fs.writeFile(diskPath, args.buffer);

  const expiresAt = new Date(Date.now() + TTL_MS);

  await prisma.waMediaArtifact.create({
    data: {
      id: artifactId,
      userId: args.userId,
      mimeType: args.mimeType || 'application/octet-stream',
      fileName,
      byteLength: args.buffer.length,
      expiresAt,
    },
  });

  const publicUrl = `${origin}/api/public/wa-media/${artifactId}`;
  return { artifactId, publicUrl };
}

export async function readWaMediaArtifact(
  artifactId: string
): Promise<{ diskPath: string; mimeType: string; fileName: string } | null> {
  const row = await prisma.waMediaArtifact.findUnique({
    where: { id: artifactId },
  });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    return null;
  }

  const dir = path.join(
    getWaMediaRoot(),
    row.userId.replace(/[^a-zA-Z0-9_-]/g, '_')
  );
  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  const match = entries.find((f) => f.startsWith(`${artifactId}_`));
  if (!match) return null;

  return {
    diskPath: path.join(dir, match),
    mimeType: row.mimeType,
    fileName: row.fileName,
  };
}

function guessExt(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes('jpeg') || m.includes('jpg')) return '.jpg';
  if (m.includes('png')) return '.png';
  if (m.includes('webp')) return '.webp';
  if (m.includes('gif')) return '.gif';
  if (m.includes('mp4')) return '.mp4';
  if (m.includes('pdf')) return '.pdf';
  if (m.includes('ogg') || m.includes('opus')) return '.ogg';
  if (m.includes('mpeg') || m.includes('mp3')) return '.mp3';
  return '.bin';
}
