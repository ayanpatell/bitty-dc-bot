import type { ParsedSms, TelnyxWebhookEvent } from '../../types/index.js';

export function parseTelnyxPayload(raw: unknown): ParsedSms {
  const event = raw as TelnyxWebhookEvent;

  const payload = event?.data?.payload;
  if (!payload) {
    throw new Error('Missing data.payload in Telnyx webhook event');
  }

  const from = payload.from?.phone_number;
  if (!from) {
    throw new Error('Missing data.payload.from.phone_number');
  }

  const messageId = payload.id;
  if (!messageId) {
    throw new Error('Missing data.payload.id');
  }

  const to = payload.to?.[0]?.phone_number ?? '';
  const body = payload.text ?? '';
  const mediaUrls = Array.isArray(payload.media)
    ? payload.media.map((m) => m.url).filter((url) => typeof url === 'string' && url.length > 0)
    : [];

  return { from, to, body, messageId, mediaUrls };
}
