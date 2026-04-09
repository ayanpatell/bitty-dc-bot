import { Router, type NextFunction, type Request, type Response } from 'express';
import { config } from '../config/index.js';
import { parseTelnyxPayload } from '../providers/telnyx/parser.js';
import { validateTelnyxSignature } from '../providers/telnyx/validator.js';
import { sendToDiscord } from '../services/discord.js';
import type { TelnyxWebhookEvent } from '../types/index.js';
import { isAllowed } from '../utils/allowlist.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Middleware: validate Telnyx ED25519 signature, then attach parsed JSON to req.body.
async function telnyxSignatureGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  const signature = req.headers['telnyx-signature-ed25519'];
  const timestamp = req.headers['telnyx-timestamp'];

  const isValid = await validateTelnyxSignature(
    req.body as Buffer,
    typeof signature === 'string' ? signature : undefined,
    typeof timestamp === 'string' ? timestamp : undefined,
    config.telnyxPublicKey,
  );

  if (!isValid) {
    logger.warn({ ip: req.ip, path: req.path }, 'Invalid Telnyx signature — rejecting request');
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  // Parse JSON after signature is verified
  try {
    req.body = JSON.parse((req.body as Buffer).toString('utf8')) as TelnyxWebhookEvent;
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  next();
}

router.post('/', telnyxSignatureGuard, async (req: Request, res: Response): Promise<void> => {
  const event = req.body as TelnyxWebhookEvent;

  // Acknowledge non-SMS events immediately (delivery receipts, status updates, etc.)
  if (event?.data?.event_type !== 'message.received') {
    logger.debug({ eventType: event?.data?.event_type }, 'Ignoring non-message event');
    res.json({ success: true });
    return;
  }

  let sms;
  try {
    sms = parseTelnyxPayload(event);
  } catch (err) {
    logger.error({ err }, 'Failed to parse Telnyx payload');
    res.status(400).json({ error: 'Bad payload' });
    return;
  }

  const log = logger.child({ messageId: sms.messageId, from: sms.from });

  if (!isAllowed(sms.from, config.allowedFromNumbers)) {
    log.warn('Sender not in allowlist — ignoring');
    res.json({ success: true });
    return;
  }

  log.info({ to: sms.to, hasMedia: sms.mediaUrls.length > 0 }, 'Forwarding SMS to Discord');

  try {
    await sendToDiscord(sms, config.discordWebhookUrl);
    log.info('Forwarded to Discord successfully');
    res.json({ success: true });
  } catch (err) {
    log.error({ err }, 'Failed to forward to Discord');
    res.status(500).json({ error: 'Failed to forward message' });
  }
});

export default router;
