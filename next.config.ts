import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@whiskeysockets/baileys',
    'pino',
    'pino-pretty',
    'thread-stream',
  ],
};

export default nextConfig;
