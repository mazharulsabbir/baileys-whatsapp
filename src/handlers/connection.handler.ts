import {
  WASocket,
  DisconnectReason,
  proto
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import config from '../config';

/**
 * Setup connection event handler
 */
export function setupConnectionHandler(
  socket: WASocket,
  logger: pino.Logger,
  saveCreds: () => Promise<void>,
  clearSessionCallback?: () => void,
  reconnectCallback?: () => Promise<void>,
  onQr?: (qr: string) => void,
  autoReconnectEnabled: boolean = config.autoReconnect,
  onConnectionOpen?: () => void
): void {
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
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      
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
      } else {
        logger.error({
          reason: lastDisconnect?.error,
          statusCode,
          reasonName: getDisconnectReason(statusCode)
        }, 'Disconnected');

        // Clear session if logged out
        if (statusCode === DisconnectReason.loggedOut) {
          logger.warn('Session logged out. Clear credentials and re-scan QR.');
        }
      }
    } else if (connection === 'open') {
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
  socket.ws.on('CB:stream:error', (error: any) => {
    logger.error({ error }, 'Stream error received from WhatsApp');
  });
}

/**
 * Determine if should reconnect based on disconnect reason
 */
function shouldReconnectOnDisconnect(statusCode: number | undefined): boolean {
  if (!statusCode) return true;

  const reconnectReasons = [
    DisconnectReason.connectionClosed,
    DisconnectReason.connectionLost,
    DisconnectReason.connectionReplaced,
    DisconnectReason.restartRequired,
    DisconnectReason.timedOut,
    DisconnectReason.badSession,
    DisconnectReason.multideviceMismatch
  ];

  return reconnectReasons.includes(statusCode);
}

/**
 * Get human-readable disconnect reason
 */
export function getDisconnectReason(statusCode: number | undefined): string {
  if (!statusCode) return 'Unknown';

  switch (statusCode) {
    case DisconnectReason.connectionClosed:
      return 'Connection closed';
    case DisconnectReason.connectionLost:
      return 'Connection lost';
    case DisconnectReason.connectionReplaced:
      return 'Connection replaced (another session logged in)';
    case DisconnectReason.restartRequired:
      return 'Restart required';
    case DisconnectReason.timedOut:
      return 'Connection timed out';
    case DisconnectReason.loggedOut:
      return 'Logged out';
    case DisconnectReason.badSession:
      return 'Bad session (clear credentials and re-scan)';
    case DisconnectReason.multideviceMismatch:
      return 'Multi-device mismatch';
    default:
      return `Unknown reason (${statusCode})`;
  }
}
