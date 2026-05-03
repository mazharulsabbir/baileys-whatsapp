/**
 * Map legacy `@c.us` suffix to `@s.whatsapp.net` so the same contact matches inbound/outbound IDs.
 */
export function normalizePhoneJidDomain(jid: string): string {
  const at = jid.indexOf('@');
  if (at < 0) return jid;
  const user = jid.slice(0, at);
  const host = jid.slice(at + 1);
  if (host !== 'c.us') return jid;
  const digits = user.replace(/\D/g, '');
  if (!digits) return jid;
  return `${digits}@s.whatsapp.net`;
}

/**
 * Normalize API `to` field to a WhatsApp JID.
 * Accepts full JIDs or E.164-like digits (international, no +).
 */
export function normalizeToJid(to: string): string {
  const trimmed = to.trim();
  if (!trimmed) {
    throw new Error('Empty recipient');
  }
  if (trimmed.includes('@')) {
    return normalizePhoneJidDomain(trimmed);
  }
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) {
    throw new Error('Invalid phone number');
  }
  return `${digits}@s.whatsapp.net`;
}
