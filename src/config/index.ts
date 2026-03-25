import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // WhatsApp session settings
  sessionName: process.env.SESSION_NAME || 'whatsapp_session',
  
  // Authentication method: 'qr' or 'pairing'
  authMethod: (process.env.AUTH_METHOD || 'qr') as 'qr' | 'pairing',
  
  // Phone number for pairing code (with country code, e.g., '1234567890')
  phoneNumber: process.env.PHONE_NUMBER || '',
  
  // Browser info for WhatsApp Web
  browser: {
    name: process.env.BROWSER_NAME || 'Chrome',
    version: process.env.BROWSER_VERSION || '120.0.0',
    os: process.env.BROWSER_OS || 'Mac OS'
  },
  
  // Sync full history (set to true for complete chat history)
  syncFullHistory: process.env.SYNC_FULL_HISTORY === 'true',
  
  // Print QR code in terminal
  printQRInTerminal: process.env.PRINT_QR !== 'false',
  
  // Logger level: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent'
  logLevel: (process.env.LOG_LEVEL || 'info') as 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent',
  
  // Auto-reconnect on disconnect
  autoReconnect: process.env.AUTO_RECONNECT !== 'false',
  
  // Default prefix for commands (if building a bot)
  commandPrefix: process.env.COMMAND_PREFIX || '!',
  
  // Admin phone numbers (for bot administration)
  adminNumbers: process.env.ADMIN_NUMBERS?.split(',') || []
};

export default config;
