import type { WAMessage, WASocket } from '@whiskeysockets/baileys';
import { downloadMediaMessage, isJidGroup } from '@whiskeysockets/baileys';
import type { Logger } from 'pino';
import { canonicalChatJidFromKey, type ChatKeyLike } from '@/lib/canonical-chat-jid';
import { normalizePhoneJidDomain } from '@/lib/jid';
import { saveInboundMedia } from '@/lib/wa-media-store';

function tsToNumber(ts: unknown): number | undefined {
  if (ts == null) return undefined;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'object' && ts !== null && 'low' in ts) {
    const low = (ts as { low?: number }).low;
    if (typeof low === 'number') return low;
  }
  return undefined;
}

/** Strip JID to digits-only number expected by Odoo `clean_number`. */
export function jidToOdooNumber(remoteJid: string | undefined): string {
  if (!remoteJid) return '';
  const user = remoteJid.split('@')[0] ?? '';
  return user.replace(/\D/g, '');
}

function extractMessageContent(message: WAMessage): string | null {
  const msg = message.message;
  if (!msg) return null;
  if (msg.conversation) return msg.conversation;
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
  if (msg.imageMessage?.caption) return msg.imageMessage.caption;
  if (msg.videoMessage?.caption) return msg.videoMessage.caption;
  if (msg.documentMessage?.caption) return msg.documentMessage.caption;
  if (msg.locationMessage) {
    return `Location: ${msg.locationMessage.degreesLatitude}, ${msg.locationMessage.degreesLongitude}`;
  }
  if (msg.contactMessage) {
    return `Contact: ${msg.contactMessage.displayName}`;
  }
  if (msg.pollCreationMessage) {
    return `Poll: ${msg.pollCreationMessage.name}`;
  }
  if (msg.reactionMessage?.text) {
    return `Reaction: ${msg.reactionMessage.text}`;
  }
  return null;
}

function getMessageType(message: WAMessage): string {
  const msg = message.message;
  if (!msg) return 'unknown';
  if (msg.conversation || msg.extendedTextMessage) return 'text';
  if (msg.imageMessage) return 'image';
  if (msg.videoMessage) return 'video';
  if (msg.audioMessage) return 'audio';
  if (msg.documentMessage) return 'document';
  if (msg.stickerMessage) return 'sticker';
  if (msg.locationMessage) return 'location';
  if (msg.contactMessage) return 'contact';
  if (msg.pollCreationMessage) return 'poll';
  if (msg.reactionMessage) return 'reaction';
  return 'unknown';
}

const MEDIA_FALLBACK: Record<string, string> = {
  image: '[Image]',
  video: '[Video]',
  audio: '[Audio]',
  document: '[Document]',
  sticker: '[Sticker]',
  location: '[Location]',
  contact: '[Contact]',
  poll: '[Poll]',
  reaction: '[Reaction]',
  unknown: '[Message]',
};

/**
 * Instagram-allowed media formats (mirrors Odoo validation)
 * Source: odoo-modules/whatsapp_connector/models/Message.py:12-15
 */
const INSTAGRAM_AUDIO_FORMATS = [
  'audio/x-wav',
  'audio/mp4',
  'audio/wav',
  'audio/wave',
  'audio/aac',
  'audio/x-m4a',
  'audio/m4a'
];

const INSTAGRAM_VIDEO_FORMATS = [
  'video/x-msvideo',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/ogg',
  'video/avi'
];

/**
 * Detect conversation type from WhatsApp JID suffix.
 * - @s.whatsapp.net → 'normal' (individual chat)
 * - @l.us → 'private' (WhatsApp Business / Large account)
 * - @g.us → 'group' (group chat)
 */
function detectConversationType(jid: string): 'normal' | 'private' | 'group' {
  if (!jid) return 'normal';

  if (jid.endsWith('@g.us')) {
    return 'group';
  } else if (jid.endsWith('@l.us')) {
    return 'private';
  } else {
    return 'normal';
  }
}

/**
 * Extract quoted message stanza ID from WAMessage context info.
 * Checks multiple message types that can contain quoted messages.
 */
function extractQuotedMessageId(message: WAMessage): string | null {
  const msg = message.message;
  if (!msg) return null;

  // Check extended text message (most common for text replies)
  const extQuote = msg.extendedTextMessage?.contextInfo?.stanzaId;
  if (extQuote) return extQuote;

  // Check image message with caption/reply
  const imgQuote = msg.imageMessage?.contextInfo?.stanzaId;
  if (imgQuote) return imgQuote;

  // Check video message with caption/reply
  const vidQuote = msg.videoMessage?.contextInfo?.stanzaId;
  if (vidQuote) return vidQuote;

  // Check audio message reply
  const audioQuote = msg.audioMessage?.contextInfo?.stanzaId;
  if (audioQuote) return audioQuote;

  // Check document message reply
  const docQuote = msg.documentMessage?.contextInfo?.stanzaId;
  if (docQuote) return docQuote;

  // Check sticker message reply
  const stickerQuote = msg.stickerMessage?.contextInfo?.stanzaId;
  if (stickerQuote) return stickerQuote;

  return null;
}

/**
 * Extract structured contact data from contact message.
 * Returns vCard data for Odoo to process.
 */
function extractContactData(message: WAMessage): Record<string, unknown> | null {
  const contactMsg = message.message?.contactMessage;
  if (!contactMsg) return null;

  return {
    displayName: contactMsg.displayName || '',
    vcard: contactMsg.vcard || '',
  };
}

/**
 * Validate media format for Instagram compatibility.
 * Instagram has stricter format requirements than WhatsApp.
 * @param connectorType - The connector type (e.g., 'instagram', 'whatsapp')
 * @param messageType - The message type (e.g., 'audio', 'video')
 * @param mimetype - The MIME type of the media
 * @returns Validation result with error message if invalid
 */
export function validateInstagramMedia(
  connectorType: string,
  messageType: string,
  mimetype: string
): { valid: boolean; error?: string } {
  // Only validate for Instagram connector
  if (connectorType !== 'instagram') {
    return { valid: true };
  }

  if (messageType === 'audio') {
    if (!INSTAGRAM_AUDIO_FORMATS.includes(mimetype)) {
      return {
        valid: false,
        error: `Instagram audio format not supported: ${mimetype}. Allowed: ${INSTAGRAM_AUDIO_FORMATS.join(', ')}`
      };
    }
  } else if (messageType === 'video') {
    if (!INSTAGRAM_VIDEO_FORMATS.includes(mimetype)) {
      return {
        valid: false,
        error: `Instagram video format not supported: ${mimetype}. Allowed: ${INSTAGRAM_VIDEO_FORMATS.join(', ')}`
      };
    }
  }

  return { valid: true };
}

/** Matches Odoo `msgid` / inbound `id` (prefix encodes from_me for apichat.io). */
export function buildCompositeMsgId(key: ChatKeyLike & {
  id?: string | null;
  fromMe?: boolean | null;
}): string {
  const fm = key.fromMe ? 'true' : 'false';
  const waId = key.id ?? '';
  const jidResolved =
    canonicalChatJidFromKey(key) ??
    (key.remoteJid ? normalizePhoneJidDomain(key.remoteJid) : '');
  const jid = jidResolved || key.remoteJid || '';
  return `${fm}_${waId}_${jid}`;
}

/**
 * Single inbound row for Odoo `parse_message_receive` (apichat.io).
 * Default `type: text`; see `prepareAcuxInboundRow` for hosted media URLs.
 */
export function waMessageToAcuxInbound(message: WAMessage): Record<string, unknown> {
  const chatId = canonicalChatJidFromKey(message.key) ?? message.key.remoteJid ?? '';
  const id = buildCompositeMsgId({
    id: message.key.id,
    remoteJid: message.key.remoteJid,
    remoteJidAlt: message.key.remoteJidAlt,
    fromMe: message.key.fromMe ?? false,
  });

  const rawType = getMessageType(message);
  const content = extractMessageContent(message);
  let txt = (content ?? '').trim();
  if (!txt) {
    txt = MEDIA_FALLBACK[rawType] ?? MEDIA_FALLBACK.unknown;
  }

  const number = jidToOdooNumber(chatId);
  const ts = tsToNumber(message.messageTimestamp);
  const timeSec =
    ts != null
      ? ts > 1e12
        ? Math.floor(ts / 1000)
        : Math.floor(ts)
      : Math.floor(Date.now() / 1000);

  const row: Record<string, unknown> = {
    type: 'text',
    txt,
    id,
    number,
    name: message.pushName ?? '',
    filename: '',
    url: '',
    time: timeSec,
  };

  // Detect conversation type (normal, private, group)
  const convType = detectConversationType(chatId);

  // Only include conv_type if not 'normal' (Odoo default)
  if (convType !== 'normal') {
    row.conv_type = convType;
  }

  // For group messages, include the participant/author
  if (convType === 'group' && message.key.participant) {
    row.author = message.key.participant;
  }

  // Extract quoted message ID if this is a reply
  const quotedMsgId = extractQuotedMessageId(message);
  if (quotedMsgId) {
    row.quote_msg_id = quotedMsgId;
  }

  // Extract structured contact data if this is a contact message
  const contactData = extractContactData(message);
  if (contactData) {
    row.contact_data = contactData;
  }

  return row;
}

/**
 * Download media when possible and fill `url`, `filename`, and native `type` for Odoo attachments.
 */
export async function prepareAcuxInboundRow(
  socket: WASocket,
  message: WAMessage,
  userId: string,
  logger: Logger
): Promise<Record<string, unknown>> {
  const row = { ...waMessageToAcuxInbound(message) };
  const rawType = getMessageType(message);
  const normalized = rawType === 'document' ? 'file' : rawType;

  if (!['image', 'video', 'audio', 'file', 'sticker'].includes(normalized)) {
    return row;
  }

  try {
    const buffer = await downloadMediaMessage(message, 'buffer', {}, {
      logger,
      reuploadRequest: socket.updateMediaMessage,
    });

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      return row;
    }

    const msg = message.message;
    let mime = 'application/octet-stream';
    let suggestedName = 'media';

    if (msg?.imageMessage) {
      mime = msg.imageMessage.mimetype || 'image/jpeg';
      suggestedName = 'image';
    } else if (msg?.videoMessage) {
      mime = msg.videoMessage.mimetype || 'video/mp4';
      suggestedName = 'video';
    } else if (msg?.audioMessage) {
      mime = msg.audioMessage.mimetype || 'audio/ogg';
      suggestedName = 'audio';
    } else if (msg?.documentMessage) {
      mime = msg.documentMessage.mimetype || 'application/octet-stream';
      suggestedName =
        String((msg.documentMessage as { fileName?: string }).fileName || '') ||
        'document';
    } else if (msg?.stickerMessage) {
      mime = msg.stickerMessage.mimetype || 'image/webp';
      suggestedName = 'sticker.webp';
    }

    const saved = await saveInboundMedia({
      userId,
      buffer,
      mimeType: mime,
      suggestedFileName: suggestedName,
    });

    if (!saved) {
      return row;
    }

    const odType = rawType === 'document' ? 'file' : rawType;
    row.type = odType;
    row.url = saved.publicUrl;
    row.filename = suggestedName.includes('.')
      ? suggestedName
      : `${suggestedName}.${mime.split('/')[1]?.slice(0, 8) || 'bin'}`;

    const cap = extractMessageContent(message)?.trim();
    if (cap) {
      row.txt = cap;
    } else if (typeof row.txt === 'string' && row.txt.startsWith('[')) {
      row.txt = row.filename as string;
    }
  } catch (err) {
    logger.warn({ err }, 'Odoo inbound media download skipped');
  }

  return row;
}
