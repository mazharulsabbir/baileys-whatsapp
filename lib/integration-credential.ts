import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

const KEY_PREFIX = 'bw_live_';

function generateApiKey(): string {
  return KEY_PREFIX + crypto.randomBytes(24).toString('hex');
}

function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function getCredentialForUser(userId: string) {
  return prisma.integrationCredential.findUnique({
    where: { userId },
  });
}

/** Returns masked display info (never the full API key). */
export async function getCredentialPublic(userId: string) {
  const c = await getCredentialForUser(userId);
  if (!c) {
    return {
      hasApiKey: false as const,
      apiKeyPrefix: null as string | null,
      webhookUrl: null as string | null,
      hasWebhookSecret: false,
      enabled: false,
    };
  }
  return {
    hasApiKey: true as const,
    apiKeyPrefix: c.apiKeyPrefix || null,
    webhookUrl: c.webhookUrl,
    hasWebhookSecret: Boolean(c.webhookSecret),
    enabled: c.enabled,
  };
}

export type RotateApiKeyResult = {
  apiKey: string;
  apiKeyPrefix: string;
};

/**
 * Create or replace API key. Plain key is returned once.
 */
export async function rotateApiKey(userId: string): Promise<RotateApiKeyResult> {
  const plain = generateApiKey();
  const apiKeyHash = await bcrypt.hash(plain, 12);
  const apiKeyPrefix = plain.slice(0, 12) + '…';

  await prisma.integrationCredential.upsert({
    where: { userId },
    create: {
      userId,
      apiKeyHash,
      apiKeyPrefix,
      enabled: true,
    },
    update: {
      apiKeyHash,
      apiKeyPrefix,
      enabled: true,
    },
  });

  return { apiKey: plain, apiKeyPrefix };
}

export async function updateWebhookSettings(
  userId: string,
  input: {
    webhookUrl?: string | null;
    rotateWebhookSecret?: boolean;
    webhookSecret?: string | null;
  }
): Promise<{ webhookSecret?: string }> {
  const existing = await prisma.integrationCredential.findUnique({
    where: { userId },
  });
  if (!existing) {
    throw new Error('Create an API key first (Integration section).');
  }

  const out: { webhookSecret?: string } = {};
  let newSecret: string | null | undefined;

  if (input.rotateWebhookSecret) {
    const s = generateWebhookSecret();
    newSecret = s;
    out.webhookSecret = s;
  } else if (input.webhookSecret !== undefined) {
    newSecret = input.webhookSecret;
  }

  const nextUrl =
    input.webhookUrl !== undefined ? input.webhookUrl : existing.webhookUrl;

  await prisma.integrationCredential.update({
    where: { userId },
    data: {
      webhookUrl: nextUrl,
      ...(newSecret !== undefined ? { webhookSecret: newSecret } : {}),
    },
  });

  return out;
}
