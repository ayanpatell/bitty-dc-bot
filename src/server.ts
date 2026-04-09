import 'dotenv/config'; // Must be the very first import — loads .env before config module runs

import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';

const app = createApp();

// Log the raw PORT env var so Railway logs show exactly what port Node is binding to
const rawPort = process.env['PORT'];
logger.info({ PORT_env: rawPort, config_port: config.port }, 'Binding server...');

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, 'Server started and listening');
});

// Graceful shutdown — Render/Railway send SIGTERM before replacing the instance.
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received — shutting down');
  server.close(() => process.exit(0));
});
