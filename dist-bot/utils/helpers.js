"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatJid = formatJid;
exports.extractPhoneFromJid = extractPhoneFromJid;
exports.isGroupJid = isGroupJid;
exports.isUserJid = isUserJid;
exports.formatTimestamp = formatTimestamp;
exports.sleep = sleep;
exports.isValidPhoneNumber = isValidPhoneNumber;
exports.getExtensionFromMimeType = getExtensionFromMimeType;
exports.formatFileSize = formatFileSize;
exports.escapeWhatsAppText = escapeWhatsAppText;
exports.parseMentions = parseMentions;
exports.addMentions = addMentions;
/**
 * Format phone number to WhatsApp JID
 * @param phoneNumber - Phone number (with or without country code)
 * @param isGroup - Whether this is a group ID
 * @returns Formatted JID string
 */
function formatJid(phoneNumber, isGroup = false) {
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
function extractPhoneFromJid(jid) {
    return jid.split('@')[0];
}
/**
 * Check if JID is a group
 * @param jid - WhatsApp JID
 * @returns True if group
 */
function isGroupJid(jid) {
    return jid.endsWith('@g.us');
}
/**
 * Check if JID is a user
 * @param jid - WhatsApp JID
 * @returns True if user
 */
function isUserJid(jid) {
    return jid.endsWith('@s.whatsapp.net');
}
/**
 * Format timestamp to readable date
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted date string
 */
function formatTimestamp(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
}
/**
 * Sleep for specified milliseconds
 * @param ms - Milliseconds to sleep
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Validate phone number format
 * @param phoneNumber - Phone number to validate
 * @returns True if valid format
 */
function isValidPhoneNumber(phoneNumber) {
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    return cleanNumber.length >= 10 && cleanNumber.length <= 15;
}
/**
 * Get file extension from MIME type
 * @param mimeType - MIME type string
 * @returns File extension
 */
function getExtensionFromMimeType(mimeType) {
    const mimeToExt = {
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
function formatFileSize(bytes) {
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
function escapeWhatsAppText(text) {
    return text.replace(/[_*~`]/g, '\\$&');
}
/**
 * Parse mention JIDs from text
 * @param text - Text with mentions (e.g., "@1234567890")
 * @returns Array of mentioned JIDs
 */
function parseMentions(text) {
    const mentions = [];
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
function addMentions(text, phoneNumbers) {
    let result = text;
    for (const phone of phoneNumbers) {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        result = result.replace(new RegExp(`@${cleanPhone}`, 'g'), `@${cleanPhone}`);
    }
    return result;
}
//# sourceMappingURL=helpers.js.map