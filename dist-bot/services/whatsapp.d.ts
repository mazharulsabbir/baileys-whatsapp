import { WASocket, proto } from '@whiskeysockets/baileys';
import pino from 'pino';
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
}
export declare class WhatsAppService {
    private socket;
    private logger;
    private authPath;
    private opts;
    private latestQr;
    constructor(options: WhatsAppServiceOptions);
    /** Latest QR payload from Baileys (until paired or cleared) */
    getLatestQr(): string | null;
    clearLatestQr(): void;
    getTenantId(): string;
    /**
     * Initialize and connect to WhatsApp
     */
    connect(): Promise<void>;
    /**
     * Setup all event handlers
     */
    private setupEventHandlers;
    /**
     * Handle authentication (QR or Pairing Code)
     */
    private handleAuthentication;
    /**
     * Send a text message
     */
    sendMessage(jid: string, text: string, options?: {
        quoted?: proto.IWebMessageInfo;
        mentions?: string[];
    }): Promise<void>;
    /**
     * Send an image message
     */
    sendImage(jid: string, image: Buffer | string, caption?: string): Promise<void>;
    /**
     * Send a video message
     */
    sendVideo(jid: string, video: Buffer | string, caption?: string): Promise<void>;
    /**
     * Send an audio message
     */
    sendAudio(jid: string, audio: Buffer | string, ptt?: boolean): Promise<void>;
    /**
     * Send a document message
     */
    sendDocument(jid: string, document: Buffer | string, fileName?: string, caption?: string): Promise<void>;
    /**
     * Send a location message
     */
    sendLocation(jid: string, latitude: number, longitude: number, name?: string): Promise<void>;
    /**
     * Send a contact message
     */
    sendContact(jid: string, phoneNumber: string, displayName: string): Promise<void>;
    /**
     * Send a poll message
     */
    sendPoll(jid: string, name: string, values: string[], multipleAnswers?: boolean): Promise<void>;
    /**
     * Send a reaction to a message
     */
    sendReaction(jid: string, key: proto.IMessageKey, reaction: string): Promise<void>;
    /**
     * Reply to a message
     */
    reply(jid: string, text: string, quoted: proto.IWebMessageInfo): Promise<void>;
    /**
     * Delete a message
     */
    deleteMessage(jid: string, key: proto.IMessageKey): Promise<void>;
    /**
     * Edit a message
     */
    editMessage(jid: string, key: proto.IMessageKey, newText: string): Promise<void>;
    /**
     * Send presence update (typing, recording, online, offline)
     */
    sendPresenceUpdate(type: 'available' | 'unavailable' | 'composing' | 'recording' | 'paused', jid?: string): Promise<void>;
    /**
     * Get socket instance
     */
    getSocket(): WASocket | null;
    /**
     * Check if connected
     */
    isConnected(): boolean;
    /**
     * Disconnect from WhatsApp
     */
    disconnect(): Promise<void>;
}
export declare function createWhatsAppService(options: WhatsAppServiceOptions): WhatsAppService;
/** CLI / legacy single-folder session: `authBaseDir/tenantId` matches former `cwd/sessionName` */
export declare function createDefaultWhatsAppService(): WhatsAppService;
export declare const whatsappService: WhatsAppService;
export default whatsappService;
//# sourceMappingURL=whatsapp.d.ts.map