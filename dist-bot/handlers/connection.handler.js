"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupConnectionHandler = setupConnectionHandler;
exports.getDisconnectReason = getDisconnectReason;
const baileys_1 = require("@whiskeysockets/baileys");
const config_1 = __importDefault(require("../config"));
/**
 * Setup connection event handler
 */
function setupConnectionHandler(socket, logger, saveCreds, clearSessionCallback, reconnectCallback, onQr, autoReconnectEnabled = config_1.default.autoReconnect, onConnectionOpen) {
    let restartRequiredCount = 0;
    const MAX_RESTART_ATTEMPTS = 2;
    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr, receivedPendingNotifications } = update;
        // Handle QR code (if not using pairing code)
        if (qr) {
            logger.info('QR code received - waiting for scan...');
            onQr?.(qr);
            return;
        }
        // Handle connection status
        if (connection === 'close') {
            logger.warn('Connection closed');
            // Get disconnect reason
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            // Handle error 515 (restart required) - clear session after multiple attempts
            if (statusCode === 515) {
                restartRequiredCount++;
                logger.warn({ attempt: restartRequiredCount }, 'Restart required error received');
                if (restartRequiredCount >= MAX_RESTART_ATTEMPTS) {
                    logger.error('Multiple restart required errors. Clearing session and re-authenticating...');
                    if (clearSessionCallback) {
                        clearSessionCallback();
                    }
                    restartRequiredCount = 0;
                    return;
                }
            }
            const shouldReconnect = shouldReconnectOnDisconnect(statusCode);
            if (shouldReconnect && autoReconnectEnabled) {
                logger.info('Reconnecting...');
                if (reconnectCallback) {
                    reconnectCallback().catch((err) => {
                        logger.error(err, 'Failed to reconnect');
                    });
                }
            }
            else {
                logger.error({
                    reason: lastDisconnect?.error,
                    statusCode,
                    reasonName: getDisconnectReason(statusCode)
                }, 'Disconnected');
                // Clear session if logged out
                if (statusCode === baileys_1.DisconnectReason.loggedOut) {
                    logger.warn('Session logged out. Clear credentials and re-scan QR.');
                }
            }
        }
        else if (connection === 'open') {
            // Reset restart counter on successful connection
            restartRequiredCount = 0;
            logger.info('✅ Connected to WhatsApp');
            logger.info(`Phone number: ${socket.user?.id.split(':')[0] || 'Unknown'}`);
            onConnectionOpen?.();
        }
        // Handle connection received
        if (receivedPendingNotifications) {
            logger.info('Received pending notifications');
        }
    });
    // Handle WebSocket errors
    socket.ws.on('CB:stream:error', (error) => {
        logger.error({ error }, 'Stream error received from WhatsApp');
    });
}
/**
 * Determine if should reconnect based on disconnect reason
 */
function shouldReconnectOnDisconnect(statusCode) {
    if (!statusCode)
        return true;
    const reconnectReasons = [
        baileys_1.DisconnectReason.connectionClosed,
        baileys_1.DisconnectReason.connectionLost,
        baileys_1.DisconnectReason.connectionReplaced,
        baileys_1.DisconnectReason.restartRequired,
        baileys_1.DisconnectReason.timedOut,
        baileys_1.DisconnectReason.badSession,
        baileys_1.DisconnectReason.multideviceMismatch
    ];
    return reconnectReasons.includes(statusCode);
}
/**
 * Get human-readable disconnect reason
 */
function getDisconnectReason(statusCode) {
    if (!statusCode)
        return 'Unknown';
    switch (statusCode) {
        case baileys_1.DisconnectReason.connectionClosed:
            return 'Connection closed';
        case baileys_1.DisconnectReason.connectionLost:
            return 'Connection lost';
        case baileys_1.DisconnectReason.connectionReplaced:
            return 'Connection replaced (another session logged in)';
        case baileys_1.DisconnectReason.restartRequired:
            return 'Restart required';
        case baileys_1.DisconnectReason.timedOut:
            return 'Connection timed out';
        case baileys_1.DisconnectReason.loggedOut:
            return 'Logged out';
        case baileys_1.DisconnectReason.badSession:
            return 'Bad session (clear credentials and re-scan)';
        case baileys_1.DisconnectReason.multideviceMismatch:
            return 'Multi-device mismatch';
        default:
            return `Unknown reason (${statusCode})`;
    }
}
//# sourceMappingURL=connection.handler.js.map