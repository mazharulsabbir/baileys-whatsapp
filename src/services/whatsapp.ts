import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
  fetchLatestBaileysVersion,
  Browsers
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import path from 'path';
import fs from 'fs';
import config from '../config';
import { setupConnectionHandler } from '../handlers/connection.handler';
import { setupMessageHandler } from '../handlers/message.handler';
import type { InboundWebhookPayload } from '../webhook-types';
import { deliverOdooFailedMessage } from '@/lib/odoo-webhook-delivery';
import { buildCompositeMsgId } from '@/lib/odoo-acrux-mapper';

/** Options for a tenant-scoped WhatsApp connection */
export interface WhatsAppServiceOptions {
  tenantId: string;
  /** Directory containing per-tenant session folders (e.g. `join(root, tenantId)`) */
  authBaseDir: string;
  logger?: pino.Logger;
  authMethod?: 'qr' | 'pairing';
  phoneNumber?: string;
  printQRInTerminal?: boolean;
  syncFullHistory?: boolean;
  autoReconnect?: boolean;
  /** Called whenever a new QR string is available (web dashboard) */
  onQr?: (qr: string) => void;
  /** SaaS: forward inbound messages to Odoo / automation (optional) */
  onInboundWebhook?: (payload: InboundWebhookPayload) => void;
  /** SaaS: WhatsApp socket open/close (Odoo phone-status events) */
  onConnectionState?: (state: 'open' | 'close') => void;
}

/**
 * Get MIME type from file extension
 */
function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'mp4': 'video/mp4',
    'avi': 'video/avi',
    'mov': 'video/quicktime',
    'mp3': 'audio/mpeg',
    'ogg': 'audio/ogg',
    'wav': 'audio/wav',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'txt': 'text/plain',
    'zip': 'application/zip'
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Clear session data
 */
function clearSession(authPath: string, logger: pino.Logger): void {
  try {
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
      logger.info('Session data cleared');
    }
  } catch (error) {
    logger.error(error, 'Failed to clear session data');
  }
}

export class WhatsAppService {
  private socket: WASocket | null = null;
  private logger: pino.Logger;
  private authPath: string;
  private opts: WhatsAppServiceOptions;
  private latestQr: string | null = null;

  constructor(options: WhatsAppServiceOptions) {
    this.opts = options;
    const safeId = options.tenantId.replace(/[^a-zA-Z0-9_-]/g, '_');
    this.authPath = path.join(options.authBaseDir, safeId);

    this.logger =
      options.logger ??
      pino({
        level: config.logLevel,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true
          }
        }
      });
  }

  /** Latest QR payload from Baileys (until paired or cleared) */
  getLatestQr(): string | null {
    return this.latestQr;
  }

  clearLatestQr(): void {
    this.latestQr = null;
  }

  getTenantId(): string {
    return this.opts.tenantId;
  }

  /**
   * Initialize and connect to WhatsApp
   */
  async connect(): Promise<void> {
    try {
      // Load authentication state
      const { state, saveCreds } = await useMultiFileAuthState(this.authPath);

      // Get latest WhatsApp version
      const { version } = await fetchLatestBaileysVersion();

      this.logger.info('Connecting to WhatsApp...');

      // Use a more compatible browser configuration
      // Try Ubuntu Chrome instead of Mac
      const browserConfig = Browsers.ubuntu('Chrome');

      // Create socket connection with retry configuration
      this.socket = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false, // We'll handle QR printing manually
        logger: this.logger.child({ class: 'baileys' }),
        browser: browserConfig,
        syncFullHistory: this.opts.syncFullHistory ?? config.syncFullHistory,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 500,
        maxMsgRetryCount: 5,
        fireInitQueries: true,
        shouldIgnoreJid: (jid) => {
          // Ignore broadcast and status messages
          return jid.endsWith('@broadcast') || jid.endsWith('@newsletter');
        }
      });

      // Setup event handlers
      this.setupEventHandlers(saveCreds);

      // Handle QR code or pairing code
      await this.handleAuthentication();

      this.logger.info('Connection initiated');

    } catch (error: any) {
      this.logger.error({
        error: error?.message || error,
        stack: error?.stack
      }, 'Failed to connect to WhatsApp');

      // Check for common issues
      if (error?.message?.includes('WebSocket')) {
        this.logger.warn('WebSocket connection failed. Check your internet connection and firewall settings.');
        this.logger.warn('WhatsApp servers may be temporarily unavailable. Try again in a few moments.');
      }

      throw error;
    }
  }

  /**
   * Setup all event handlers
   */
  private setupEventHandlers(saveCreds: () => Promise<void>): void {
    if (!this.socket) return;

    // Connection updates
    setupConnectionHandler(
      this.socket,
      this.logger,
      saveCreds,
      () => clearSession(this.authPath, this.logger),
      () => this.connect(),
      (qr) => {
        this.latestQr = qr;
        this.opts.onQr?.(qr);
        if (this.opts.printQRInTerminal ?? config.printQRInTerminal) {
          qrcode.generate(qr, { small: true }, (ascii) => {
            console.log('\n📱 Scan this QR code with WhatsApp:\n');
            console.log(ascii);
            console.log('\n');
          });
        }
      },
      this.opts.autoReconnect ?? config.autoReconnect,
      () => {
        this.latestQr = null;
      },
      this.opts.onConnectionState
    );

    setupMessageHandler(
      this.socket,
      this.logger,
      this.opts.tenantId,
      this.opts.onInboundWebhook
    );

    // Save credentials on update
    this.socket.ev.on('creds.update', saveCreds);
  }

  /**
   * Handle authentication (QR or Pairing Code)
   */
  private async handleAuthentication(): Promise<void> {
    if (!this.socket) return;

    const authMethod = this.opts.authMethod ?? config.authMethod;
    const phoneNumber = this.opts.phoneNumber ?? config.phoneNumber;

    if (authMethod === 'pairing' && phoneNumber) {
      const result = await this.socket.requestPairingCode(phoneNumber);
      this.logger.info(`Pairing code: ${result}`);
      console.log(`\n📱 Pairing Code: ${result}\n`);
    }
    // QR flow is handled via setupConnectionHandler onQr (no duplicate listeners)
  }

  /**
   * Send a text message.
   * @returns WhatsApp message id when available
   */
  async sendMessage(jid: string, text: string, options?: {
    quoted?: proto.IWebMessageInfo;
    mentions?: string[];
  }): Promise<string | undefined> {
    if (!this.socket) {
      throw new Error('Socket not initialized. Call connect() first.');
    }

    const message: any = {
      text,
      mentions: options?.mentions
    };

    if (options?.quoted) {
      message.quoted = options.quoted;
    }

    try {
      const result = await this.socket.sendMessage(jid, message);
      return result?.key?.id ?? undefined;
    } catch (error) {
      // Build composite message ID for Odoo correlation
      const msgid = buildCompositeMsgId({
        id: Date.now().toString(), // Temporary ID since send failed
        remoteJid: jid,
        fromMe: true
      });

      const reason = error instanceof Error
        ? error.message
        : 'Failed to send message';

      // Report failure to Odoo if tenant ID is available
      if (this.opts.tenantId) {
        deliverOdooFailedMessage(this.opts.tenantId, msgid, reason);
      }

      this.logger.error({ error, jid, text }, 'Failed to send text message');
      throw error; // Re-throw for caller handling
    }
  }

  /**
   * Send an image message
   */
  async sendImage(jid: string, image: Buffer | string, caption?: string): Promise<void> {
    if (!this.socket) {
      throw new Error('Socket not initialized. Call connect() first.');
    }

    try {
      await this.socket.sendMessage(jid, {
        image: typeof image === 'string' ? { url: image } : image,
        caption
      });
    } catch (error) {
      const msgid = buildCompositeMsgId({
        id: Date.now().toString(),
        remoteJid: jid,
        fromMe: true
      });
      const reason = error instanceof Error ? error.message : 'Failed to send image';

      if (this.opts.tenantId) {
        deliverOdooFailedMessage(this.opts.tenantId, msgid, reason);
      }

      this.logger.error({ error, jid, caption }, 'Failed to send image message');
      throw error;
    }
  }

  /**
   * Send a video message
   */
  async sendVideo(jid: string, video: Buffer | string, caption?: string): Promise<void> {
    if (!this.socket) {
      throw new Error('Socket not initialized. Call connect() first.');
    }

    try {
      await this.socket.sendMessage(jid, {
        video: typeof video === 'string' ? { url: video } : video,
        caption
      });
    } catch (error) {
      const msgid = buildCompositeMsgId({
        id: Date.now().toString(),
        remoteJid: jid,
        fromMe: true
      });
      const reason = error instanceof Error ? error.message : 'Failed to send video';

      if (this.opts.tenantId) {
        deliverOdooFailedMessage(this.opts.tenantId, msgid, reason);
      }

      this.logger.error({ error, jid, caption }, 'Failed to send video message');
      throw error;
    }
  }

  /**
   * Send an audio message
   */
  async sendAudio(jid: string, audio: Buffer | string, ptt: boolean = false): Promise<void> {
    if (!this.socket) {
      throw new Error('Socket not initialized. Call connect() first.');
    }

    try {
      await this.socket.sendMessage(jid, {
        audio: typeof audio === 'string' ? { url: audio } : audio,
        ptt,
        mimetype: 'audio/ogg; codecs=opus'
      });
    } catch (error) {
      const msgid = buildCompositeMsgId({
        id: Date.now().toString(),
        remoteJid: jid,
        fromMe: true
      });
      const reason = error instanceof Error ? error.message : 'Failed to send audio';

      if (this.opts.tenantId) {
        deliverOdooFailedMessage(this.opts.tenantId, msgid, reason);
      }

      this.logger.error({ error, jid, ptt }, 'Failed to send audio message');
      throw error;
    }
  }

  /**
   * Send a document message
   */
  async sendDocument(jid: string, document: Buffer | string, fileName?: string, caption?: string): Promise<void> {
    if (!this.socket) {
      throw new Error('Socket not initialized. Call connect() first.');
    }

    try {
      await this.socket.sendMessage(jid, {
        document: typeof document === 'string' ? { url: document } : document,
        fileName,
        caption,
        mimetype: fileName ? getMimeType(fileName) : 'application/octet-stream'
      });
    } catch (error) {
      const msgid = buildCompositeMsgId({
        id: Date.now().toString(),
        remoteJid: jid,
        fromMe: true
      });
      const reason = error instanceof Error ? error.message : 'Failed to send document';

      if (this.opts.tenantId) {
        deliverOdooFailedMessage(this.opts.tenantId, msgid, reason);
      }

      this.logger.error({ error, jid, fileName }, 'Failed to send document message');
      throw error;
    }
  }

  /**
   * Send a location message
   */
  async sendLocation(jid: string, latitude: number, longitude: number, name?: string): Promise<void> {
    if (!this.socket) {
      throw new Error('Socket not initialized. Call connect() first.');
    }

    try {
      await this.socket.sendMessage(jid, {
        location: {
          degreesLatitude: latitude,
          degreesLongitude: longitude,
          name
        }
      });
    } catch (error) {
      const msgid = buildCompositeMsgId({
        id: Date.now().toString(),
        remoteJid: jid,
        fromMe: true
      });
      const reason = error instanceof Error ? error.message : 'Failed to send location';

      if (this.opts.tenantId) {
        deliverOdooFailedMessage(this.opts.tenantId, msgid, reason);
      }

      this.logger.error({ error, jid, latitude, longitude }, 'Failed to send location message');
      throw error;
    }
  }

  /**
   * Send a contact message
   */
  async sendContact(jid: string, phoneNumber: string, displayName: string): Promise<void> {
    if (!this.socket) {
      throw new Error('Socket not initialized. Call connect() first.');
    }

    try {
      await this.socket.sendMessage(jid, {
        contacts: {
          displayName,
          contacts: [{
            displayName,
            vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${displayName}\nTEL;type=CELL;type=VOICE;waid=${phoneNumber.replace(/[^0-9]/g, '')}:${phoneNumber}\nEND:VCARD`
          }]
        }
      });
    } catch (error) {
      const msgid = buildCompositeMsgId({
        id: Date.now().toString(),
        remoteJid: jid,
        fromMe: true
      });
      const reason = error instanceof Error ? error.message : 'Failed to send contact';

      if (this.opts.tenantId) {
        deliverOdooFailedMessage(this.opts.tenantId, msgid, reason);
      }

      this.logger.error({ error, jid, displayName }, 'Failed to send contact message');
      throw error;
    }
  }

  /**
   * Send a poll message
   */
  async sendPoll(jid: string, name: string, values: string[], multipleAnswers: boolean = false): Promise<void> {
    if (!this.socket) {
      throw new Error('Socket not initialized. Call connect() first.');
    }

    try {
      await this.socket.sendMessage(jid, {
        poll: {
          name,
          values,
          selectableCount: multipleAnswers ? values.length : 1
        }
      });
    } catch (error) {
      const msgid = buildCompositeMsgId({
        id: Date.now().toString(),
        remoteJid: jid,
        fromMe: true
      });
      const reason = error instanceof Error ? error.message : 'Failed to send poll';

      if (this.opts.tenantId) {
        deliverOdooFailedMessage(this.opts.tenantId, msgid, reason);
      }

      this.logger.error({ error, jid, name }, 'Failed to send poll message');
      throw error;
    }
  }

  /**
   * Send a reaction to a message
   */
  async sendReaction(jid: string, key: proto.IMessageKey, reaction: string): Promise<void> {
    if (!this.socket) {
      throw new Error('Socket not initialized. Call connect() first.');
    }

    try {
      await this.socket.sendMessage(jid, {
        react: {
          text: reaction,
          key
        }
      });
    } catch (error) {
      const msgid = buildCompositeMsgId({
        id: Date.now().toString(),
        remoteJid: jid,
        fromMe: true
      });
      const reason = error instanceof Error ? error.message : 'Failed to send reaction';

      if (this.opts.tenantId) {
        deliverOdooFailedMessage(this.opts.tenantId, msgid, reason);
      }

      this.logger.error({ error, jid, reaction }, 'Failed to send reaction');
      throw error;
    }
  }

  /**
   * Reply to a message
   */
  async reply(jid: string, text: string, quoted: proto.IWebMessageInfo): Promise<void> {
    await this.sendMessage(jid, text, { quoted });
  }

  /**
   * Delete a message
   */
  async deleteMessage(jid: string, key: proto.IMessageKey): Promise<void> {
    if (!this.socket) {
      throw new Error('Socket not initialized. Call connect() first.');
    }

    await this.socket.sendMessage(jid, { delete: key });
  }

  /**
   * Edit a message
   */
  async editMessage(jid: string, key: proto.IMessageKey, newText: string): Promise<void> {
    if (!this.socket) {
      throw new Error('Socket not initialized. Call connect() first.');
    }

    await this.socket.sendMessage(jid, {
      text: newText,
      edit: key
    });
  }

  /**
   * Send presence update (typing, recording, online, offline)
   */
  async sendPresenceUpdate(type: 'available' | 'unavailable' | 'composing' | 'recording' | 'paused', jid?: string): Promise<void> {
    if (!this.socket) {
      throw new Error('Socket not initialized. Call connect() first.');
    }

    await this.socket.sendPresenceUpdate(type, jid);
  }

  /**
   * Get socket instance
   */
  getSocket(): WASocket | null {
    return this.socket;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket !== null && this.socket.user != null;
  }

  /**
   * Disconnect from WhatsApp
   */
  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.end(undefined);
      this.socket = null;
      this.latestQr = null;
      this.logger.info('Disconnected from WhatsApp');
    }
  }
}

export function createWhatsAppService(options: WhatsAppServiceOptions): WhatsAppService {
  return new WhatsAppService(options);
}

/** CLI / legacy single-folder session: `authBaseDir/tenantId` matches former `cwd/sessionName` */
export function createDefaultWhatsAppService(): WhatsAppService {
  return createWhatsAppService({
    tenantId: config.sessionName,
    authBaseDir: process.cwd(),
    authMethod: config.authMethod,
    phoneNumber: config.phoneNumber,
    printQRInTerminal: config.printQRInTerminal,
    syncFullHistory: config.syncFullHistory,
    autoReconnect: config.autoReconnect
  });
}

export const whatsappService = createDefaultWhatsAppService();
export default whatsappService;
