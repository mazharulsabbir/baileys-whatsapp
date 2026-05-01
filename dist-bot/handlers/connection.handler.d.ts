import { WASocket } from '@whiskeysockets/baileys';
import pino from 'pino';
/**
 * Setup connection event handler
 */
export declare function setupConnectionHandler(socket: WASocket, logger: pino.Logger, saveCreds: () => Promise<void>, clearSessionCallback?: () => void, reconnectCallback?: () => Promise<void>, onQr?: (qr: string) => void, autoReconnectEnabled?: boolean, onConnectionOpen?: () => void): void;
/**
 * Get human-readable disconnect reason
 */
export declare function getDisconnectReason(statusCode: number | undefined): string;
//# sourceMappingURL=connection.handler.d.ts.map