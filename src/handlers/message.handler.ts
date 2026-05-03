import {
  WASocket,
  proto,
  WAMessage,
  getKeyAuthor,
  isJidGroup
} from '@whiskeysockets/baileys';
import pino from 'pino';
import config from '../config';
import type { InboundWebhookPayload } from '../webhook-types';
import { canonicalChatJidFromKey } from '@/lib/canonical-chat-jid';
import { prepareAcuxInboundRow } from '@/lib/odoo-acrux-mapper';
import { deliverAcuxInboundRow, deliverAcuxMessageDeletes } from '@/lib/odoo-webhook-delivery';

function tsToNumber(ts: unknown): number | undefined {
  if (ts == null) return undefined;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'object' && ts !== null && 'low' in ts) {
    const low = (ts as { low?: number }).low;
    if (typeof low === 'number') return low;
  }
  return undefined;
}

/**
 * Setup message event handlers
 * @param tenantId SaaS user id for outbound webhooks (omit for CLI-only bots)
 */
export function setupMessageHandler(
  socket: WASocket,
  logger: pino.Logger,
  tenantId?: string,
  onInboundWebhook?: (payload: InboundWebhookPayload) => void
): void {
  // Handle new messages
  socket.ev.on('messages.upsert', async (event) => {
    const { messages, type } = event;

    if (type === 'notify') {
      for (const message of messages) {
        await handleMessage(socket, message, logger, tenantId, onInboundWebhook);
      }
    }
  });

  // Handle message updates (edits, reactions, poll votes)
  socket.ev.on('messages.update', async (updates) => {
    for (const update of updates) {
      logger.debug({
        key: update.key,
        update: update.update
      }, 'Message update');

      // Handle poll updates
      if (update.update.pollUpdates) {
        logger.info('Poll vote received');
      }
    }
  });

  // Handle message delete (revoke) → Odoo ChatRoom `deleted` event
  socket.ev.on('messages.delete', async (event) => {
    logger.debug(event, 'Messages deleted');
    if (!tenantId) return;
    if ('keys' in event && Array.isArray(event.keys) && event.keys.length > 0) {
      deliverAcuxMessageDeletes(tenantId, event.keys);
    }
  });

  // Handle message reaction
  socket.ev.on('messages.reaction', async (reactions) => {
    for (const reaction of reactions) {
      logger.debug({
        key: reaction.key,
        reaction: reaction.reaction
      }, 'Message reaction');
    }
  });

  // Handle group updates
  socket.ev.on('groups.update', async (updates) => {
    logger.info(updates, 'Group updates');
  });

  // Handle group participant updates
  socket.ev.on('group-participants.update', async (update) => {
    logger.info({
      id: update.id,
      participants: update.participants,
      action: update.action
    }, 'Group participants update');
  });

  // Handle chat updates (read receipts, etc.)
  socket.ev.on('chats.update', async (updates) => {
    logger.debug(updates, 'Chat updates');
  });

  // Handle presence updates
  socket.ev.on('presence.update', async (update) => {
    logger.debug({
      id: update.id,
      presences: update.presences
    }, 'Presence update');
  });

  // Handle call events
  socket.ev.on('call', async (calls) => {
    for (const call of calls) {
      logger.info({
        from: call.from,
        id: call.id,
        status: call.status
      }, 'Call received');
    }
  });
}

/**
 * Process individual message
 */
async function handleMessage(
  socket: WASocket,
  message: WAMessage,
  logger: pino.Logger,
  tenantId?: string,
  onInboundWebhook?: (payload: InboundWebhookPayload) => void
): Promise<void> {
  const chatId = canonicalChatJidFromKey(message.key) ?? message.key.remoteJid;
  const isGroup = Boolean(chatId && isJidGroup(chatId));
  const fromMe = message.key.fromMe;
  const senderId = getKeyAuthor(message.key) || (message.key.remoteJid ?? '');
  const senderName = message.pushName || 'Unknown';

  let groupName: string | undefined;
  if (isGroup && chatId) {
    try {
      const groupMetadata = await socket.groupMetadata(chatId);
      groupName = groupMetadata.subject;
    } catch (err) {
      logger.debug({ err, chatId }, 'Failed to fetch group metadata');
    }
  }

  logger.info({
    messageId: message.key.id,
    timestamp: message.messageTimestamp,
    direction: fromMe ? 'outgoing' : 'incoming',
    from: senderId,
    senderName,
    chat: chatId,
    ...(groupName && { groupName }),
    isGroup,
    type: getMessageType(message)
  }, fromMe ? 'Outgoing message' : 'Incoming message');

  // Extract message content
  const messageContent = extractMessageContent(message);

  if (messageContent) {
    logger.info({ content: messageContent }, 'Message content');
  }

  // Log media metadata if present
  const mediaMsg = message.message?.imageMessage ||
                   message.message?.videoMessage ||
                   message.message?.audioMessage ||
                   message.message?.documentMessage;

  if (mediaMsg) {
    logger.info({
      type: getMessageType(message),
      mimetype: mediaMsg.mimetype,
      fileLength: mediaMsg.fileLength?.toString(),
      fileName: (message.message?.documentMessage as any)?.fileName
    }, 'Media message');
  }

  // Handle commands only for incoming messages
  if (!fromMe && messageContent && typeof messageContent === 'string') {
    await handleCommand(socket, message, messageContent, logger);
  }

  // Flat JSON webhook (Bearer integration)
  if (!fromMe && tenantId && onInboundWebhook) {
    onInboundWebhook({
      event: 'message.received',
      tenantId,
      messageId: message.key.id ?? undefined,
      from: typeof senderId === 'string' ? senderId : String(senderId ?? ''),
      chatId: chatId ?? undefined,
      type: getMessageType(message),
      text:
        messageContent != null && typeof messageContent === 'string'
          ? messageContent
          : null,
      senderName,
      isGroup,
      timestamp: tsToNumber(message.messageTimestamp),
      ...(groupName ? { groupName } : {}),
    });
  }

  // Odoo ChatRoom Acrux-shaped webhook (requires config_set URL on gateway credentials)
  if (!fromMe && tenantId) {
    console.log('[WEBHOOK DEBUG] Processing inbound message for Odoo', {
      tenantId,
      messageId: message.key.id,
      chatId: chatId
    });

    try {
      const row = await prepareAcuxInboundRow(socket, message, tenantId, logger);
      console.log('[WEBHOOK DEBUG] Prepared Acrux row:', {
        type: row.type,
        txt: typeof row.txt === 'string' ? row.txt.substring(0, 50) : row.txt,
        id: row.id,
        number: row.number
      });

      deliverAcuxInboundRow(tenantId, row);
      console.log('[WEBHOOK DEBUG] deliverAcuxInboundRow called');
    } catch (e) {
      console.error('[WEBHOOK DEBUG] Odoo Acrux inbound prepare/delivery failed:', e);
      logger.warn({ e }, 'Odoo Acrux inbound prepare/delivery failed');
    }
  }
}

/**
 * Extract message content from various message types
 */
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
  if (msg.reactionMessage) {
    return `Reaction: ${msg.reactionMessage.text}`;
  }

  return null;
}

/**
 * Get message type
 */
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

/**
 * Handle bot commands
 */
async function handleCommand(
  socket: WASocket,
  message: WAMessage,
  content: string,
  logger: pino.Logger
): Promise<void> {
  const chatId = canonicalChatJidFromKey(message.key) ?? message.key.remoteJid;
  if (!chatId) return;

  const trimmedContent = content.trim();
  
  // Check if message starts with command prefix
  if (!trimmedContent.startsWith(config.commandPrefix)) {
    return;
  }

  const command = trimmedContent.slice(config.commandPrefix.length).split(' ')[0].toLowerCase();
  const args = trimmedContent.slice(config.commandPrefix.length).split(' ').slice(1);

  logger.info({ command, args }, 'Command received');

  // Simple command handler
  switch (command) {
    case 'ping':
      await socket.sendMessage(chatId, { text: '🏓 Pong!' }, { quoted: message });
      break;

    case 'help':
      await socket.sendMessage(chatId, {
        text: `🤖 *Bot Commands*\n\n` +
              `${config.commandPrefix}ping - Check if bot is online\n` +
              `${config.commandPrefix}help - Show this help message\n` +
              `${config.commandPrefix}info - Show bot information`
      }, { quoted: message });
      break;

    case 'info':
      await socket.sendMessage(chatId, {
        text: `*Baileys WhatsApp Bot*\n\n` +
              `Version: 1.0.0\n` +
              `Library: @whiskeysockets/baileys\n` +
              `Prefix: ${config.commandPrefix}`
      }, { quoted: message });
      break;

    default:
      logger.info({ command }, 'Unknown command');
  }
}
