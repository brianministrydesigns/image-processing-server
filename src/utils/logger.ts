import pino from 'pino';
import { config } from '../config/config';

/**
 * Logger configuration
 * Uses Pino for structured logging
 */
export const logger = pino({
  level: config.server.env === 'production' ? 'info' : 'debug',
  transport:
    config.server.env === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
          },
        }
      : undefined,
  base: undefined,
});
