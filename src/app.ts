import express, { type NextFunction, type Request, type Response } from 'express';
import healthRouter from './routes/health.js';
import telnyxRouter from './routes/telnyx.js';
import { logger } from './utils/logger.js';

export function createApp(): express.Application {
  const app = express();

  // Parse raw body for Telnyx webhook — must be raw Buffer for signature verification.
  // JSON parsing happens inside the signature guard after verification passes.
  app.use('/webhook/telnyx', express.raw({ type: 'application/json' }));

  app.use('/', healthRouter);
  app.use('/webhook/telnyx', telnyxRouter);

  // 404
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, 'Unhandled error');
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
