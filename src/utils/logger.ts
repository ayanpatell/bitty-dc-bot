import pino from 'pino';

// Config is not imported here to avoid circular dependency — logger is used by config.
// Level and env are read directly from process.env with safe defaults.
const isDev = (process.env['NODE_ENV'] ?? 'development') === 'development';
const level = process.env['LOG_LEVEL'] ?? 'info';

export const logger = pino({
  level,
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        },
      }
    : {}),
});
