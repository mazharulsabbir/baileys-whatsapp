import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

/** Known plaintext for {@link BCRYPT_DUMMY_HASH} — used for timing normalization only. */
const GATEWAY_AUTH_DUMMY_PLAINTEXT = 'ogw-dummy-ct-9f2a1c3e';

/**
 * Precomputed bcrypt (cost 12) of {@link GATEWAY_AUTH_DUMMY_PLAINTEXT} — compare against this when
 * no credential row exists so we still run one bcrypt round instead of fast-rejecting before compare.
 */
const BCRYPT_DUMMY_HASH =
  '$2b$12$rA5Uv6BOCBled1xqGj6yk.DsjJRF8561Qi51KDuOSdPJV.dJ8rOJW';

/**
 * Resolve tenant userId from Odoo connector headers (token + client_id).
 */
export async function resolveUserIdFromGatewayHeaders(
  token: string | undefined,
  clientId: string | undefined
): Promise<string | null> {
  const cid = clientId?.trim();
  if (!cid) {
    await bcrypt.compare(GATEWAY_AUTH_DUMMY_PLAINTEXT, BCRYPT_DUMMY_HASH);
    return null;
  }

  const row = await prisma.odooGatewayCredential.findUnique({
    where: { connectorUuid: cid },
    select: { userId: true, tokenHash: true },
  });

  const hash = row?.tokenHash ?? BCRYPT_DUMMY_HASH;
  const plain = token?.trim() || 'invalid-token';

  const ok = await bcrypt.compare(plain, hash);
  if (!row || !ok) {
    return null;
  }
  return row.userId;
}

export function extractGatewayAuth(headers: Headers): {
  token: string | undefined;
  clientId: string | undefined;
  action: string | undefined;
} {
  return {
    token: headers.get('token')?.trim() || undefined,
    clientId: headers.get('client_id')?.trim() || undefined,
    action: headers.get('action')?.trim() || undefined,
  };
}
