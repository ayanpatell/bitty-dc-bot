import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Mock config BEFORE any src imports.
// vi.hoisted runs synchronously before module imports, so mockConfig is
// available to the vi.mock factory. We update telnyxPublicKey in beforeAll
// after generating the test keypair.
// ---------------------------------------------------------------------------

const mockConfig = vi.hoisted(() => ({
  port: 3000,
  nodeEnv: 'test',
  logLevel: 'silent',
  telnyxPublicKey: '', // filled in beforeAll
  discordWebhookUrl: 'https://discord.com/api/webhooks/test/token',
  allowedFromNumbers: new Set(['+13125550001']),
}));

vi.mock('../src/config/index.js', () => ({ config: mockConfig }));

// Import app AFTER mock is registered
import { createApp } from '../src/app.js';

// ---------------------------------------------------------------------------
// Test keypair — generated once for the whole suite
// ---------------------------------------------------------------------------

let testPrivateKey: CryptoKey;

beforeAll(async () => {
  const keyPair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  testPrivateKey = keyPair.privateKey;
  const rawPublic = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  mockConfig.telnyxPublicKey = Buffer.from(rawPublic).toString('base64');
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signBody(body: string, timestamp: string): Promise<string> {
  const message = new TextEncoder().encode(`${timestamp}|${body}`);
  const sigBuffer = await crypto.subtle.sign('Ed25519', testPrivateKey, message);
  return Buffer.from(sigBuffer).toString('base64');
}

function makeInboundSmsBody(from = '+13125550001'): string {
  return JSON.stringify({
    data: {
      event_type: 'message.received',
      id: 'event-id-1',
      record_type: 'event',
      payload: {
        id: 'msg-id-abc',
        text: 'Hello from test',
        from: { phone_number: from },
        to: [{ phone_number: '+17735550002' }],
        media: [],
        type: 'SMS',
        received_at: '2024-01-15T20:16:07.503+00:00',
      },
    },
    meta: { attempt: 1, delivered_to: 'https://example.com/webhook/telnyx' },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
    expect(typeof res.body.ts).toBe('string');
  });
});

describe('GET unknown route', () => {
  it('returns 404', async () => {
    const app = createApp();
    const res = await request(app).get('/not-a-real-path');
    expect(res.status).toBe(404);
  });
});

describe('POST /webhook/telnyx — signature validation', () => {
  it('returns 403 when signature header is missing', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/webhook/telnyx')
      .set('Content-Type', 'application/json')
      .send(makeInboundSmsBody());
    expect(res.status).toBe(403);
  });

  it('returns 403 when signature is wrong', async () => {
    const app = createApp();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const res = await request(app)
      .post('/webhook/telnyx')
      .set('Content-Type', 'application/json')
      .set('telnyx-signature-ed25519', 'aGVsbG8gd29ybGQ=') // invalid
      .set('telnyx-timestamp', timestamp)
      .send(makeInboundSmsBody());
    expect(res.status).toBe(403);
  });

  it('returns 403 when timestamp is stale (>5 min old)', async () => {
    const app = createApp();
    const body = makeInboundSmsBody();
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 400);
    const sig = await signBody(body, staleTimestamp);
    const res = await request(app)
      .post('/webhook/telnyx')
      .set('Content-Type', 'application/json')
      .set('telnyx-signature-ed25519', sig)
      .set('telnyx-timestamp', staleTimestamp)
      .send(body);
    expect(res.status).toBe(403);
  });
});

describe('POST /webhook/telnyx — message handling', () => {
  it('returns 200 and calls Discord for allowed sender', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const app = createApp();
    const body = makeInboundSmsBody('+13125550001');
    const timestamp = String(Math.floor(Date.now() / 1000));
    const sig = await signBody(body, timestamp);

    const res = await request(app)
      .post('/webhook/telnyx')
      .set('Content-Type', 'application/json')
      .set('telnyx-signature-ed25519', sig)
      .set('telnyx-timestamp', timestamp)
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });

  it('returns 200 for blocked sender WITHOUT calling Discord', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const app = createApp();
    const body = makeInboundSmsBody('+19999999999'); // not in allowlist
    const timestamp = String(Math.floor(Date.now() / 1000));
    const sig = await signBody(body, timestamp);

    const res = await request(app)
      .post('/webhook/telnyx')
      .set('Content-Type', 'application/json')
      .set('telnyx-signature-ed25519', sig)
      .set('telnyx-timestamp', timestamp)
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 200 and ignores non-message.received events', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const app = createApp();
    const body = JSON.stringify({
      data: { event_type: 'message.sent', id: 'evt-2', record_type: 'event', payload: {} },
      meta: { attempt: 1, delivered_to: '' },
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const sig = await signBody(body, timestamp);

    const res = await request(app)
      .post('/webhook/telnyx')
      .set('Content-Type', 'application/json')
      .set('telnyx-signature-ed25519', sig)
      .set('telnyx-timestamp', timestamp)
      .send(body);

    expect(res.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 500 when Discord webhook call fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve('Service Unavailable'),
      }),
    );
    const app = createApp();
    const body = makeInboundSmsBody('+13125550001');
    const timestamp = String(Math.floor(Date.now() / 1000));
    const sig = await signBody(body, timestamp);

    const res = await request(app)
      .post('/webhook/telnyx')
      .set('Content-Type', 'application/json')
      .set('telnyx-signature-ed25519', sig)
      .set('telnyx-timestamp', timestamp)
      .send(body);

    expect(res.status).toBe(500);
  });
});
