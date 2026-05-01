"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupMessageHandler = setupMessageHandler;
const baileys_1 = require("@whiskeysockets/baileys");
const config_1 = __importDefault(require("../config"));
/**
 * Setup message event handlers
 */
function setupMessageHandler(socket, logger) {
    // Handle new messages
    socket.ev.on('messages.upsert', async (event) => {
        const { messages, type } = event;
        if (type === 'notify') {
            for (const message of messages) {
                await handleMessage(socket, message, logger);
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
    // Handle message delete
    socket.ev.on('messages.delete', async (event) => {
        logger.debug(event, 'Messages deleted');
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
async function handleMessage(socket, message, logger) {
    const chatId = message.key.remoteJid;
    const isGroup = chatId ? (0, baileys_1.isJidGroup)(chatId) : false;
    const fromMe = message.key.fromMe;
    const senderId = fromMe ? 'me' : (message.key.participant || message.key.remoteJid);
    const senderName = message.pushName || 'Unknown';
    let groupName;
    if (isGroup && chatId) {
        try {
            const groupMetadata = await socket.groupMetadata(chatId);
            groupName = groupMetadata.subject;
        }
        catch (err) {
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
            fileName: message.message?.documentMessage?.fileName
        }, 'Media message');
    }
    // Handle commands only for incoming messages
    if (!fromMe && messageContent && typeof messageContent === 'string') {
        await handleCommand(socket, message, messageContent, logger);
    }
}
/**
 * Extract message content from various message types
 */
function extractMessageContent(message) {
    const msg = message.message;
    if (!msg)
        return null;
    if (msg.conversation)
        return msg.conversation;
    if (msg.extendedTextMessage?.text)
        return msg.extendedTextMessage.text;
    if (msg.imageMessage?.caption)
        return msg.imageMessage.caption;
    if (msg.videoMessage?.caption)
        return msg.videoMessage.caption;
    if (msg.documentMessage?.caption)
        return msg.documentMessage.caption;
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
function getMessageType(message) {
    const msg = message.message;
    if (!msg)
        return 'unknown';
    if (msg.conversation || msg.extendedTextMessage)
        return 'text';
    if (msg.imageMessage)
        return 'image';
    if (msg.videoMessage)
        return 'video';
    if (msg.audioMessage)
        return 'audio';
    if (msg.documentMessage)
        return 'document';
    if (msg.stickerMessage)
        return 'sticker';
    if (msg.locationMessage)
        return 'location';
    if (msg.contactMessage)
        return 'contact';
    if (msg.pollCreationMessage)
        return 'poll';
    if (msg.reactionMessage)
        return 'reaction';
    return 'unknown';
}
/**
 * Handle bot commands
 */
async function handleCommand(socket, message, content, logger) {
    const chatId = message.key.remoteJid;
    if (!chatId)
        return;
    const trimmedContent = content.trim();
    // Check if message starts with command prefix
    if (!trimmedContent.startsWith(config_1.default.commandPrefix)) {
        return;
    }
    const command = trimmedContent.slice(config_1.default.commandPrefix.length).split(' ')[0].toLowerCase();
    const args = trimmedContent.slice(config_1.default.commandPrefix.length).split(' ').slice(1);
    logger.info({ command, args }, 'Command received');
    // Simple command handler
    switch (command) {
        case 'ping':
            await socket.sendMessage(chatId, { text: '🏓 Pong!' }, { quoted: message });
            break;
        case 'help':
            await socket.sendMessage(chatId, {
                text: `🤖 *Bot Commands*\n\n` +
                    `${config_1.default.commandPrefix}ping - Check if bot is online\n` +
                    `${config_1.default.commandPrefix}help - Show this help message\n` +
                    `${config_1.default.commandPrefix}info - Show bot information`
            }, { quoted: message });
            break;
        case 'info':
            await socket.sendMessage(chatId, {
                text: `*Baileys WhatsApp Bot*\n\n` +
                    `Version: 1.0.0\n` +
                    `Library: @whiskeysockets/baileys\n` +
                    `Prefix: ${config_1.default.commandPrefix}`
            }, { quoted: message });
            break;
        default:
            logger.info({ command }, 'Unknown command');
    }
}
//# sourceMappingURL=message.handler.js.map