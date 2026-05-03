import pino from 'pino';

/**
 * Pino logger without a `pino-pretty` transport worker. Bare `target: 'pino-pretty'`
 * breaks under Next.js bundling; worker threads also fail to resolve transports in some
 * server layouts. For readable local logs: `npm run dev 2>&1 | npx pino-pretty`.
 */
export function createDefaultPinoLogger(
  level: pino.LevelWithSilent
): pino.Logger {
  return pino({ level });
}
