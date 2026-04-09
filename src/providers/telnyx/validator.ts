import { webcrypto } from 'node:crypto';

// Telnyx webhook signature validation using ED25519 (Web Crypto API, Node 18+).
//
// Telnyx signs webhooks by computing:
//   ED25519_Sign(privateKey, `${timestamp}|${rawBody}`)
//
// We verify using the public key from Mission Control → Keys & Credentials.
//
// The key from the portal may be in one of two formats:
//   - PEM-encoded SPKI  (starts with "-----BEGIN PUBLIC KEY-----")
//   - Raw 32-byte key   (base64-encoded, 44 characters)
// Both are handled automatically.

const REPLAY_WINDOW_SECONDS = 300; // 5 minutes

/**
 * Import an Ed25519 public key from either PEM-encoded SPKI or raw base64.
 * Telnyx Mission Control typically provides the key in PEM format.
 */
async function importPublicKey(publicKeyInput: string): Promise<webcrypto.CryptoKey> {
  const trimmed = publicKeyInput.trim();

  if (trimmed.startsWith('-----BEGIN PUBLIC KEY-----')) {
    // PEM → strip headers → base64 → DER bytes → SPKI import
    const b64 = trimmed
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/[\r\n\s]/g, '');
    const der = Buffer.from(b64, 'base64');
    return webcrypto.subtle.importKey('spki', der, { name: 'Ed25519' }, false, ['verify']);
  }

  // Raw 32-byte Ed25519 public key, base64-encoded (44 chars)
  const raw = Buffer.from(trimmed, 'base64');
  return webcrypto.subtle.importKey('raw', raw, { name: 'Ed25519' }, false, ['verify']);
}

export async function validateTelnyxSignature(
  rawBody: Buffer,
  signature: string | undefined,
  timestamp: string | undefined,
  publicKeyInput: string,
): Promise<boolean> {
  try {
    if (!signature || !timestamp) return false;

    // Replay attack prevention: reject requests older than 5 minutes
    const requestTimeSec = parseInt(timestamp, 10);
    if (isNaN(requestTimeSec)) return false;
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - requestTimeSec) > REPLAY_WINDOW_SECONDS) return false;

    // Reconstruct the signed string Telnyx uses
    const signingString = `${timestamp}|${rawBody.toString('utf8')}`;

    const publicKey = await importPublicKey(publicKeyInput);

    const signatureBytes = Buffer.from(signature, 'base64');
    const messageBytes = new TextEncoder().encode(signingString);

    return await webcrypto.subtle.verify('Ed25519', publicKey, signatureBytes, messageBytes);
  } catch {
    return false;
  }
}
