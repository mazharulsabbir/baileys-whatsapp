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
    return trimmed;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) {
    throw new Error('Invalid phone number');
  }
  return `${digits}@s.whatsapp.net`;
}
