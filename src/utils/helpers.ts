/**
 * Format phone number to WhatsApp JID
 * @param phoneNumber - Phone number (with or without country code)
 * @param isGroup - Whether this is a group ID
 * @returns Formatted JID string
 */
export function formatJid(phoneNumber: string, isGroup: boolean = false): string {
  const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
  
  if (isGroup) {
    return `${cleanNumber}@g.us`;
  }
  
  return `${cleanNumber}@s.whatsapp.net`;
}

/**
 * Extract phone number from JID
 * @param jid - WhatsApp JID
 * @returns Phone number without suffix
 */
export function extractPhoneFromJid(jid: string): string {
  return jid.split('@')[0];
}

/**
 * Check if JID is a group
 * @param jid - WhatsApp JID
 * @returns True if group
 */
export function isGroupJid(jid: string): boolean {
  return jid.endsWith('@g.us');
}

/**
 * Check if JID is a user
 * @param jid - WhatsApp JID
 * @returns True if user
 */
export function isUserJid(jid: string): boolean {
  return jid.endsWith('@s.whatsapp.net');
}

/**
 * Format timestamp to readable date
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted date string
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

/**
 * Sleep for specified milliseconds
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate phone number format
 * @param phoneNumber - Phone number to validate
 * @returns True if valid format
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
  return cleanNumber.length >= 10 && cleanNumber.length <= 15;
}

/**
 * Get file extension from MIME type
 * @param mimeType - MIME type string
 * @returns File extension
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/plain': 'txt'
  };
  
  return mimeToExt[mimeType] || 'bin';
}

/**
 * Format file size to human-readable string
 * @param bytes - File size in bytes
 * @returns Formatted size string
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Escape special characters in text for WhatsApp
 * @param text - Text to escape
 * @returns Escaped text
 */
export function escapeWhatsAppText(text: string): string {
  return text.replace(/[_*~`]/g, '\\$&');
}

/**
 * Parse mention JIDs from text
 * @param text - Text with mentions (e.g., "@1234567890")
 * @returns Array of mentioned JIDs
 */
export function parseMentions(text: string): string[] {
  const mentions: string[] = [];
  const mentionRegex = /@(\d+)/g;
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(`${match[1]}@s.whatsapp.net`);
  }
  
  return mentions;
}

/**
 * Add mentions to text
 * @param text - Base text
 * @param phoneNumbers - Phone numbers to mention
 * @returns Text with mentions
 */
export function addMentions(text: string, phoneNumbers: string[]): string {
  let result = text;
  for (const phone of phoneNumbers) {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    result = result.replace(new RegExp(`@${cleanPhone}`, 'g'), `@${cleanPhone}`);
  }
  return result;
}
