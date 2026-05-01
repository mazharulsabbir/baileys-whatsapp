"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.whatsappService = void 0;
const whatsapp_1 = __importDefault(require("./services/whatsapp"));
exports.whatsappService = whatsapp_1.default;
const config_1 = __importDefault(require("./config"));
exports.config = config_1.default;
const pino_1 = __importDefault(require("pino"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger = (0, pino_1.default)({
    level: config_1.default.logLevel,
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true
        }
    }
});
/**
 * Clear session data
 */
function clearSessionData() {
    const sessionPath = path_1.default.join(process.cwd(), config_1.default.sessionName);
    try {
        if (fs_1.default.existsSync(sessionPath)) {
            fs_1.default.rmSync(sessionPath, { recursive: true, force: true });
            logger.info('🗑️  Session data cleared');
        }
    }
    catch (error) {
        logger.error(error, 'Failed to clear session data');
    }
}
/**
 * Main application entry point
 */
async function main() {
    logger.info('🚀 Starting Baileys WhatsApp Bot...');
    logger.info(`Session: ${config_1.default.sessionName}`);
    logger.info(`Auth Method: ${config_1.default.authMethod}`);
    logger.info(`Command Prefix: ${config_1.default.commandPrefix}`);
    // Check for --clear-session flag
    if (process.argv.includes('--clear-session')) {
        logger.info('Clearing session data as requested...');
        clearSessionData();
    }
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        logger.info('\n🛑 Shutting down...');
        await whatsapp_1.default.disconnect();
        process.exit(0);
    });
    process.on('SIGTERM', async () => {
        logger.info('\n🛑 Terminating...');
        await whatsapp_1.default.disconnect();
        process.exit(0);
    });
    process.on('uncaughtException', (error) => {
        logger.error(error, 'Uncaught Exception');
    });
    process.on('unhandledRejection', (reason, promise) => {
        logger.error({ reason, promise }, 'Unhandled Rejection');
    });
    try {
        // Connect to WhatsApp
        await whatsapp_1.default.connect();
        logger.info('✅ Bot is ready!');
        logger.info('📱 Waiting for messages...');
        logger.info(`💡 Type "${config_1.default.commandPrefix}help" to see available commands`);
        // Example: Send a welcome message to yourself (uncomment to test)
        // setTimeout(async () => {
        //   const socket = whatsappService.getSocket();
        //   if (socket?.user?.id) {
        //     await whatsappService.sendMessage(
        //       socket.user.id,
        //       '🤖 Bot is now online and ready!'
        //     );
        //   }
        // }, 5000);
    }
    catch (error) {
        logger.error(error, '❌ Failed to start bot');
        // If it's a connection error, suggest clearing session
        if (error?.message?.includes('WebSocket') || error?.message?.includes('Stream')) {
            logger.info('');
            logger.info('💡 Try running with --clear-session flag:');
            logger.info(`   npm run dev -- --clear-session`);
            logger.info('');
        }
        process.exit(1);
    }
}
// Run the application
main().catch((error) => {
    logger.error(error, 'Fatal error');
    process.exit(1);
});
exports.default = whatsapp_1.default;
//# sourceMappingURL=index.js.map