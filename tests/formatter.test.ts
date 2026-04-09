import { describe, expect, it } from 'vitest';
import { parseTelnyxPayload } from '../src/providers/telnyx/parser.js';
import { formatDiscordMessage } from '../src/services/discord.js';
import type { TelnyxWebhookEvent } from '../src/types/index.js';

function makeEvent(
  overrides: Partial<TelnyxWebhookEvent['data']['payload']> = {},
): TelnyxWebhookEvent {
  return {
    data: {
      event_type: 'message.received',
      id: 'event-id-1',
      record_type: 'event',
      payload: {
        id: 'msg-id-123',
        text: 'Hello from my phone',
        from: { phone_number: '+13125550001' },
        to: [{ phone_number: '+17735550002' }],
        media: [],
        type: 'SMS',
        received_at: '2024-01-15T20:16:07.503+00:00',
        ...overrides,
      },
    },
    meta: { attempt: 1, delivered_to: 'https://example.com/webhook/telnyx' },
  };
}

describe('parseTelnyxPayload', () => {
  it('extracts all fields from a well-formed event', () => {
    const sms = parseTelnyxPayload(makeEvent());
    expect(sms.from).toBe('+13125550001');
    expect(sms.to).toBe('+17735550002');
    expect(sms.body).toBe('Hello from my phone');
    expect(sms.messageId).toBe('msg-id-123');
    expect(sms.mediaUrls).toEqual([]);
  });

  it('sets hasMedia correctly when media array is populated', () => {
    const sms = parseTelnyxPayload(
      makeEvent({ media: [{ url: 'https://example.com/photo.jpg', content_type: 'image/jpeg' }] }),
    );
    expect(sms.mediaUrls).toEqual(['https://example.com/photo.jpg']);
  });

  it('handles empty text body without throwing', () => {
    const sms = parseTelnyxPayload(makeEvent({ text: '' }));
    expect(sms.body).toBe('');
  });

  it('handles missing to array gracefully', () => {
    const event = makeEvent();
    event.data.payload.to = [];
    const sms = parseTelnyxPayload(event);
    expect(sms.to).toBe('');
  });

  it('throws when from.phone_number is missing', () => {
    const event = makeEvent();
    // @ts-expect-error — intentionally malformed for test
    event.data.payload.from = {};
    expect(() => parseTelnyxPayload(event)).toThrow('from.phone_number');
  });

  it('throws when payload id is missing', () => {
    const event = makeEvent();
    // @ts-expect-error — intentionally malformed for test
    event.data.payload.id = undefined;
    expect(() => parseTelnyxPayload(event)).toThrow('data.payload.id');
  });

  it('throws when data.payload is missing entirely', () => {
    expect(() => parseTelnyxPayload({ data: {} })).toThrow('data.payload');
  });

  it('filters out media items without a url', () => {
    const event = makeEvent();
    // @ts-expect-error — intentionally malformed for test
    event.data.payload.media = [{ content_type: 'image/jpeg' }, { url: 'https://ok.com/img.jpg' }];
    const sms = parseTelnyxPayload(event);
    expect(sms.mediaUrls).toEqual(['https://ok.com/img.jpg']);
  });
});

describe('formatDiscordMessage', () => {
  const makeSms = (body: string) => ({
    from: '+13125550001',
    to: '+17735550002',
    body,
    messageId: 'msg-id-123',
    mediaUrls: [],
  });

  it('includes @everyone and allowed_mentions', () => {
    const payload = formatDiscordMessage(makeSms('Open long 67110 SL risk normal'));
    expect(payload.content).toBe('@everyone');
    expect(payload.allowed_mentions?.parse).toContain('everyone');
  });

  it('classifies long entry — green, 📈', () => {
    const payload = formatDiscordMessage(makeSms('Open long 67110 SL risk normal'));
    expect(payload.embeds[0]?.color).toBe(0x57f287);
    expect(payload.embeds[0]?.title).toContain('📈');
    expect(payload.embeds[0]?.title).toContain('Long Entry');
  });

  it('classifies short entry — red, 📉', () => {
    const payload = formatDiscordMessage(makeSms('68100 sl shorts'));
    expect(payload.embeds[0]?.color).toBe(0xed4245);
    expect(payload.embeds[0]?.title).toContain('📉');
  });

  it('classifies close / take profit — yellow, 💰', () => {
    const payload = formatDiscordMessage(makeSms('Close all'));
    expect(payload.embeds[0]?.color).toBe(0xfee75c);
    expect(payload.embeds[0]?.title).toContain('💰');
  });

  it('classifies SL update — orange, 🛡️', () => {
    const payload = formatDiscordMessage(makeSms('Move sl to 66980'));
    expect(payload.embeds[0]?.color).toBe(0xff9900);
    expect(payload.embeds[0]?.title).toContain('🛡️');
  });

  it('classifies commentary — blurple, 💬', () => {
    const payload = formatDiscordMessage(makeSms('Waiting for the daily to close'));
    expect(payload.embeds[0]?.color).toBe(0x5865f2);
    expect(payload.embeds[0]?.title).toContain('💬');
  });

  it('bolds the first line of a multi-line message', () => {
    const payload = formatDiscordMessage(makeSms('Open long 67110\nSL risk normal'));
    expect(payload.embeds[0]?.description).toContain('**Open long 67110**');
    expect(payload.embeds[0]?.description).toContain('SL risk normal');
  });

  it('shows fallback text for empty body', () => {
    const payload = formatDiscordMessage(makeSms(''));
    expect(payload.embeds[0]?.description).toContain('no message body');
  });

  it('includes a timestamp', () => {
    const payload = formatDiscordMessage(makeSms('Open long'));
    expect(typeof payload.embeds[0]?.timestamp).toBe('string');
  });

  it('appends media URLs when present', () => {
    const sms = { ...makeSms('Check this chart'), mediaUrls: ['https://example.com/chart.jpg'] };
    const payload = formatDiscordMessage(sms);
    expect(payload.embeds[0]?.description).toContain('https://example.com/chart.jpg');
  });
});
