import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

/**
 * Resolve a SaaS user id from a raw API key (Bearer or X-Api-Key).
 * Returns null if invalid or disabled.
 */
export async function resolveUserIdFromApiKey(
  rawKey: string | undefined
): Promise<string | null> {
  if (!rawKey || rawKey.length < 16) {
    return null;
  }

  const rows = await prisma.integrationCredential.findMany({
    where: { enabled: true },
    select: { userId: true, apiKeyHash: true },
  });

  for (const row of rows) {
    const ok = await bcrypt.compare(rawKey, row.apiKeyHash);
    if (ok) {
      return row.userId;
    }
  }

  return null;
}

export function extractApiKeyFromRequest(headers: Headers): string | undefined {
  const auth = headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  const x = headers.get('x-api-key');
  if (x) {
    return x.trim();
  }
  return undefined;
}
