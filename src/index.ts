import whatsappService from './services/whatsapp';
import config from './config';
import { createDefaultPinoLogger } from './lib/pino-logger';
import fs from 'fs';
import path from 'path';

const logger = createDefaultPinoLogger(config.logLevel);

/**
 * Clear session data
 */
function clearSessionData(): void {
  const sessionPath = path.join(process.cwd(), config.sessionName);
  try {
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      logger.info('🗑️  Session data cleared');
    }
  } catch (error) {
    logger.error(error, 'Failed to clear session data');
  }
}

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  logger.info('🚀 Starting Baileys WhatsApp Bot...');
  logger.info(`Session: ${config.sessionName}`);
  logger.info(`Auth Method: ${config.authMethod}`);
  logger.info(`Command Prefix: ${config.commandPrefix}`);

  // Check for --clear-session flag
  if (process.argv.includes('--clear-session')) {
    logger.info('Clearing session data as requested...');
    clearSessionData();
  }

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('\n🛑 Shutting down...');
    await whatsappService.disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('\n🛑 Terminating...');
    await whatsappService.disconnect();
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
    await whatsappService.connect();

    logger.info('✅ Bot is ready!');
    logger.info('📱 Waiting for messages...');
    logger.info(`💡 Type "${config.commandPrefix}help" to see available commands`);

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

  } catch (error: any) {
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

// Export for programmatic usage
export { whatsappService, config };
export default whatsappService;
