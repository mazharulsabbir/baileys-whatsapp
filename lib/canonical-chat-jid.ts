import { isJidGroup, isLidUser } from '@whiskeysockets/baileys';

import { normalizePhoneJidDomain } from '@/lib/jid';

/** Minimal key fields Baileys uses for LID / PN threading (extended beyond WAProto.IMessageKey). */
export type ChatKeyLike = {
  remoteJid?: string | null;
  remoteJidAlt?: string | null;
};

/**
 * Single peer thread in WhatsApp can appear as `...@lid` (linked id) inbound while
 * sends use phone `...@s.whatsapp.net`. Prefer PN JID when Baileys provides `remoteJidAlt`.
 */
export function canonicalChatJidFromKey(key: ChatKeyLike): string | undefined {
  let remote = key.remoteJid ?? undefined;
  if (!remote) return undefined;

  if (isJidGroup(remote)) {
    return remote;
  }

  const alt = key.remoteJidAlt;
  if (typeof alt === 'string' && alt && isLidUser(remote) && !isLidUser(alt)) {
    remote = alt;
  }

  return normalizePhoneJidDomain(remote);
}
