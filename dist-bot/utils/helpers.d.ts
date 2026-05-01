/**
 * Format phone number to WhatsApp JID
 * @param phoneNumber - Phone number (with or without country code)
 * @param isGroup - Whether this is a group ID
 * @returns Formatted JID string
 */
export declare function formatJid(phoneNumber: string, isGroup?: boolean): string;
/**
 * Extract phone number from JID
 * @param jid - WhatsApp JID
 * @returns Phone number without suffix
 */
export declare function extractPhoneFromJid(jid: string): string;
/**
 * Check if JID is a group
 * @param jid - WhatsApp JID
 * @returns True if group
 */
export declare function isGroupJid(jid: string): boolean;
/**
 * Check if JID is a user
 * @param jid - WhatsApp JID
 * @returns True if user
 */
export declare function isUserJid(jid: string): boolean;
/**
 * Format timestamp to readable date
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted date string
 */
export declare function formatTimestamp(timestamp: number): string;
/**
 * Sleep for specified milliseconds
 * @param ms - Milliseconds to sleep
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Validate phone number format
 * @param phoneNumber - Phone number to validate
 * @returns True if valid format
 */
export declare function isValidPhoneNumber(phoneNumber: string): boolean;
/**
 * Get file extension from MIME type
 * @param mimeType - MIME type string
 * @returns File extension
 */
export declare function getExtensionFromMimeType(mimeType: string): string;
/**
 * Format file size to human-readable string
 * @param bytes - File size in bytes
 * @returns Formatted size string
 */
export declare function formatFileSize(bytes: number): string;
/**
 * Escape special characters in text for WhatsApp
 * @param text - Text to escape
 * @returns Escaped text
 */
export declare function escapeWhatsAppText(text: string): string;
/**
 * Parse mention JIDs from text
 * @param text - Text with mentions (e.g., "@1234567890")
 * @returns Array of mentioned JIDs
 */
export declare function parseMentions(text: string): string[];
/**
 * Add mentions to text
 * @param text - Base text
 * @param phoneNumbers - Phone numbers to mention
 * @returns Text with mentions
 */
export declare function addMentions(text: string, phoneNumbers: string[]): string;
//# sourceMappingURL=helpers.d.ts.map