import { ACTION_CONFIG, classifyTradeMessage } from '../utils/classify.js';
import type { DiscordWebhookPayload, ParsedSms } from '../types/index.js';

export function formatDiscordMessage(sms: ParsedSms): DiscordWebhookPayload {
  const action = classifyTradeMessage(sms.body);
  const { color, emoji, label } = ACTION_CONFIG[action];

  // Bold the first line, leave the rest as-is (messages are often multi-line)
  const lines = sms.body.trim().split('\n').filter((l) => l.trim().length > 0);
  const firstLine = lines[0] ?? '';
  const rest = lines.slice(1).join('\n').trim();
  const description =
    sms.body.trim().length === 0
      ? '_[no message body]_'
      : rest.length > 0
        ? `**${firstLine}**\n${rest}`
        : `**${firstLine}**`;

  const mediaSection =
    sms.mediaUrls.length > 0
      ? '\n\n**Media:**\n' + sms.mediaUrls.map((url) => `• ${url}`).join('\n')
      : '';

  return {
    content: '@everyone',
    allowed_mentions: { parse: ['everyone'] },
    embeds: [
      {
        title: `${emoji} New Trade Alert — ${label}`,
        description: description + mediaSection,
        color,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export async function sendToDiscord(sms: ParsedSms, webhookUrl: string): Promise<void> {
  const payload = formatDiscordMessage(sms);

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Discord webhook failed: HTTP ${response.status} — ${text}`);
  }
}
