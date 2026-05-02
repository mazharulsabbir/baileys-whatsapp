import type { WAMessage, WASocket } from '@whiskeysockets/baileys';
import { downloadMediaMessage, isJidGroup } from '@whiskeysockets/baileys';
import type { Logger } from 'pino';
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

/** Matches Odoo `msgid` / inbound `id` (prefix encodes from_me for apichat.io). */
export function buildCompositeMsgId(key: {
  id?: string | null;
  remoteJid?: string | null;
  fromMe?: boolean | null;
}): string {
  const fm = key.fromMe ? 'true' : 'false';
  const waId = key.id ?? '';
  const jid = key.remoteJid ?? '';
  return `${fm}_${waId}_${jid}`;
}

/**
 * Single inbound row for Odoo `parse_message_receive` (apichat.io).
 * Default `type: text`; see `prepareAcuxInboundRow` for hosted media URLs.
 */
export function waMessageToAcuxInbound(message: WAMessage): Record<string, unknown> {
  const chatId = message.key.remoteJid ?? '';
  const id = buildCompositeMsgId({
    id: message.key.id,
    remoteJid: message.key.remoteJid,
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

  const isGroup = Boolean(chatId && isJidGroup(chatId));
  if (isGroup && message.key.participant) {
    row.author = message.key.participant;
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
