"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappService = exports.WhatsAppService = void 0;
exports.createWhatsAppService = createWhatsAppService;
exports.createDefaultWhatsAppService = createDefaultWhatsAppService;
const baileys_1 = __importStar(require("@whiskeysockets/baileys"));
const pino_1 = __importDefault(require("pino"));
const qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const config_1 = __importDefault(require("../config"));
const connection_handler_1 = require("../handlers/connection.handler");
const message_handler_1 = require("../handlers/message.handler");
/**
 * Get MIME type from file extension
 */
function getMimeType(fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mimeTypes = {
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
function clearSession(authPath, logger) {
    try {
        if (fs_1.default.existsSync(authPath)) {
            fs_1.default.rmSync(authPath, { recursive: true, force: true });
            logger.info('Session data cleared');
        }
    }
    catch (error) {
        logger.error(error, 'Failed to clear session data');
    }
}
class WhatsAppService {
    constructor(options) {
        this.socket = null;
        this.latestQr = null;
        this.opts = options;
        const safeId = options.tenantId.replace(/[^a-zA-Z0-9_-]/g, '_');
        this.authPath = path_1.default.join(options.authBaseDir, safeId);
        this.logger =
            options.logger ??
                (0, pino_1.default)({
                    level: config_1.default.logLevel,
                    transport: {
                        target: 'pino-pretty',
                        options: {
                            colorize: true
                        }
                    }
                });
    }
    /** Latest QR payload from Baileys (until paired or cleared) */
    getLatestQr() {
        return this.latestQr;
    }
    clearLatestQr() {
        this.latestQr = null;
    }
    getTenantId() {
        return this.opts.tenantId;
    }
    /**
     * Initialize and connect to WhatsApp
     */
    async connect() {
        try {
            // Load authentication state
            const { state, saveCreds } = await (0, baileys_1.useMultiFileAuthState)(this.authPath);
            // Get latest WhatsApp version
            const { version } = await (0, baileys_1.fetchLatestBaileysVersion)();
            this.logger.info('Connecting to WhatsApp...');
            // Use a more compatible browser configuration
            // Try Ubuntu Chrome instead of Mac
            const browserConfig = baileys_1.Browsers.ubuntu('Chrome');
            // Create socket connection with retry configuration
            this.socket = (0, baileys_1.default)({
                version,
                auth: state,
                printQRInTerminal: false, // We'll handle QR printing manually
                logger: this.logger.child({ class: 'baileys' }),
                browser: browserConfig,
                syncFullHistory: this.opts.syncFullHistory ?? config_1.default.syncFullHistory,
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
        }
        catch (error) {
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
    setupEventHandlers(saveCreds) {
        if (!this.socket)
            return;
        // Connection updates
        (0, connection_handler_1.setupConnectionHandler)(this.socket, this.logger, saveCreds, () => clearSession(this.authPath, this.logger), () => this.connect(), (qr) => {
            this.latestQr = qr;
            this.opts.onQr?.(qr);
            if (this.opts.printQRInTerminal ?? config_1.default.printQRInTerminal) {
                qrcode_terminal_1.default.generate(qr, { small: true }, (ascii) => {
                    console.log('\n📱 Scan this QR code with WhatsApp:\n');
                    console.log(ascii);
                    console.log('\n');
                });
            }
        }, this.opts.autoReconnect ?? config_1.default.autoReconnect, () => {
            this.latestQr = null;
        });
        // Message updates
        (0, message_handler_1.setupMessageHandler)(this.socket, this.logger);
        // Save credentials on update
        this.socket.ev.on('creds.update', saveCreds);
    }
    /**
     * Handle authentication (QR or Pairing Code)
     */
    async handleAuthentication() {
        if (!this.socket)
            return;
        const authMethod = this.opts.authMethod ?? config_1.default.authMethod;
        const phoneNumber = this.opts.phoneNumber ?? config_1.default.phoneNumber;
        if (authMethod === 'pairing' && phoneNumber) {
            const result = await this.socket.requestPairingCode(phoneNumber);
            this.logger.info(`Pairing code: ${result}`);
            console.log(`\n📱 Pairing Code: ${result}\n`);
        }
        // QR flow is handled via setupConnectionHandler onQr (no duplicate listeners)
    }
    /**
     * Send a text message
     */
    async sendMessage(jid, text, options) {
        if (!this.socket) {
            throw new Error('Socket not initialized. Call connect() first.');
        }
        const message = {
            text,
            mentions: options?.mentions
        };
        if (options?.quoted) {
            message.quoted = options.quoted;
        }
        await this.socket.sendMessage(jid, message);
    }
    /**
     * Send an image message
     */
    async sendImage(jid, image, caption) {
        if (!this.socket) {
            throw new Error('Socket not initialized. Call connect() first.');
        }
        await this.socket.sendMessage(jid, {
            image: typeof image === 'string' ? { url: image } : image,
            caption
        });
    }
    /**
     * Send a video message
     */
    async sendVideo(jid, video, caption) {
        if (!this.socket) {
            throw new Error('Socket not initialized. Call connect() first.');
        }
        await this.socket.sendMessage(jid, {
            video: typeof video === 'string' ? { url: video } : video,
            caption
        });
    }
    /**
     * Send an audio message
     */
    async sendAudio(jid, audio, ptt = false) {
        if (!this.socket) {
            throw new Error('Socket not initialized. Call connect() first.');
        }
        await this.socket.sendMessage(jid, {
            audio: typeof audio === 'string' ? { url: audio } : audio,
            ptt,
            mimetype: 'audio/ogg; codecs=opus'
        });
    }
    /**
     * Send a document message
     */
    async sendDocument(jid, document, fileName, caption) {
        if (!this.socket) {
            throw new Error('Socket not initialized. Call connect() first.');
        }
        await this.socket.sendMessage(jid, {
            document: typeof document === 'string' ? { url: document } : document,
            fileName,
            caption,
            mimetype: fileName ? getMimeType(fileName) : 'application/octet-stream'
        });
    }
    /**
     * Send a location message
     */
    async sendLocation(jid, latitude, longitude, name) {
        if (!this.socket) {
            throw new Error('Socket not initialized. Call connect() first.');
        }
        await this.socket.sendMessage(jid, {
            location: {
                degreesLatitude: latitude,
                degreesLongitude: longitude,
                name
            }
        });
    }
    /**
     * Send a contact message
     */
    async sendContact(jid, phoneNumber, displayName) {
        if (!this.socket) {
            throw new Error('Socket not initialized. Call connect() first.');
        }
        await this.socket.sendMessage(jid, {
            contacts: {
                displayName,
                contacts: [{
                        displayName,
                        vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${displayName}\nTEL;type=CELL;type=VOICE;waid=${phoneNumber.replace(/[^0-9]/g, '')}:${phoneNumber}\nEND:VCARD`
                    }]
            }
        });
    }
    /**
     * Send a poll message
     */
    async sendPoll(jid, name, values, multipleAnswers = false) {
        if (!this.socket) {
            throw new Error('Socket not initialized. Call connect() first.');
        }
        await this.socket.sendMessage(jid, {
            poll: {
                name,
                values,
                selectableCount: multipleAnswers ? values.length : 1
            }
        });
    }
    /**
     * Send a reaction to a message
     */
    async sendReaction(jid, key, reaction) {
        if (!this.socket) {
            throw new Error('Socket not initialized. Call connect() first.');
        }
        await this.socket.sendMessage(jid, {
            react: {
                text: reaction,
                key
            }
        });
    }
    /**
     * Reply to a message
     */
    async reply(jid, text, quoted) {
        await this.sendMessage(jid, text, { quoted });
    }
    /**
     * Delete a message
     */
    async deleteMessage(jid, key) {
        if (!this.socket) {
            throw new Error('Socket not initialized. Call connect() first.');
        }
        await this.socket.sendMessage(jid, { delete: key });
    }
    /**
     * Edit a message
     */
    async editMessage(jid, key, newText) {
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
    async sendPresenceUpdate(type, jid) {
        if (!this.socket) {
            throw new Error('Socket not initialized. Call connect() first.');
        }
        await this.socket.sendPresenceUpdate(type, jid);
    }
    /**
     * Get socket instance
     */
    getSocket() {
        return this.socket;
    }
    /**
     * Check if connected
     */
    isConnected() {
        return this.socket !== null && this.socket.user != null;
    }
    /**
     * Disconnect from WhatsApp
     */
    async disconnect() {
        if (this.socket) {
            this.socket.end(undefined);
            this.socket = null;
            this.latestQr = null;
            this.logger.info('Disconnected from WhatsApp');
        }
    }
}
exports.WhatsAppService = WhatsAppService;
function createWhatsAppService(options) {
    return new WhatsAppService(options);
}
/** CLI / legacy single-folder session: `authBaseDir/tenantId` matches former `cwd/sessionName` */
function createDefaultWhatsAppService() {
    return createWhatsAppService({
        tenantId: config_1.default.sessionName,
        authBaseDir: process.cwd(),
        authMethod: config_1.default.authMethod,
        phoneNumber: config_1.default.phoneNumber,
        printQRInTerminal: config_1.default.printQRInTerminal,
        syncFullHistory: config_1.default.syncFullHistory,
        autoReconnect: config_1.default.autoReconnect
    });
}
exports.whatsappService = createDefaultWhatsAppService();
exports.default = exports.whatsappService;
//# sourceMappingURL=whatsapp.js.map