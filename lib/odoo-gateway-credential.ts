import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

const TOKEN_PREFIX = 'og_live_';

function generateConnectorUuid(): string {
  return crypto.randomUUID();
}

function generatePlainToken(): string {
  return TOKEN_PREFIX + crypto.randomBytes(24).toString('hex');
}

export type ProvisionOdooGatewayResult = {
  connectorUuid: string;
  token: string;
  tokenPrefix: string;
};

export async function provisionOdooGateway(userId: string): Promise<ProvisionOdooGatewayResult> {
  const plain = generatePlainToken();
  const tokenHash = await bcrypt.hash(plain, 12);
  const tokenPrefix = plain.slice(0, 14) + '…';
  const connectorUuid = generateConnectorUuid();

  await prisma.odooGatewayCredential.upsert({
    where: { userId },
    create: {
      userId,
      connectorUuid,
      tokenHash,
      tokenPrefix,
    },
    update: {
      connectorUuid,
      tokenHash,
      tokenPrefix,
    },
  });

  return { connectorUuid, token: plain, tokenPrefix };
}

export async function getOdooGatewayPublic(userId: string) {
  const row = await prisma.odooGatewayCredential.findUnique({
    where: { userId },
  });
  if (!row) {
    return {
      hasOdooGateway: false as const,
      odooConnectorUuid: null as string | null,
      odooTokenPrefix: null as string | null,
      odooWebhookUrl: null as string | null,
    };
  }
  return {
    hasOdooGateway: true as const,
    odooConnectorUuid: row.connectorUuid,
    odooTokenPrefix: row.tokenPrefix || null,
    odooWebhookUrl: row.odooWebhookUrl,
  };
}

export async function updateOdooConfigSet(
  userId: string,
  webhook: string,
  info?: unknown
): Promise<void> {
  const result = await prisma.odooGatewayCredential.updateMany({
    where: { userId },
    data: {
      odooWebhookUrl: webhook,
      ...(info !== undefined ? { configSetInfo: info as object } : {}),
    },
  });
  if (result.count === 0) {
    throw new Error(
      'No Odoo gateway credentials on file. Provision connector UUID and token in the dashboard first.'
    );
  }
}
