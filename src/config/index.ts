import type { AppConfig } from '../types/index.js';
import { parseAllowlist } from '../utils/allowlist.js';

function requireEnv(key: string, missing: string[]): string {
  const val = process.env[key];
  if (!val) missing.push(key);
  return val ?? '';
}

function validateUrl(name: string, value: string): void {
  try {
    new URL(value);
  } catch {
    // eslint-disable-next-line no-console
    console.error(`Invalid URL for ${name}: "${value}"`);
    process.exit(1);
  }
}

function loadConfig(): AppConfig {
  const missing: string[] = [];

  const telnyxPublicKey = requireEnv('TELNYX_PUBLIC_KEY', missing);
  const discordWebhookUrl = requireEnv('DISCORD_WEBHOOK_URL', missing);

  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  validateUrl('DISCORD_WEBHOOK_URL', discordWebhookUrl);

  const allowedFromNumbers = parseAllowlist(process.env['ALLOWED_FROM_NUMBERS'] ?? '');

  if (allowedFromNumbers.size === 0) {
    // eslint-disable-next-line no-console
    console.warn('Warning: ALLOWED_FROM_NUMBERS is empty — all inbound messages will be ignored.');
  }

  return Object.freeze({
    port: parseInt(process.env['PORT'] ?? '3000', 10),
    nodeEnv: process.env['NODE_ENV'] ?? 'development',
    logLevel: process.env['LOG_LEVEL'] ?? 'info',
    telnyxPublicKey,
    discordWebhookUrl,
    allowedFromNumbers,
  });
}

export const config = loadConfig();
