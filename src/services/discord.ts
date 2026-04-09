import type { DiscordWebhookPayload, ParsedSms } from '../types/index.js';

export function formatDiscordMessage(sms: ParsedSms): DiscordWebhookPayload {
  const body = sms.body.length > 0 ? sms.body : '_[no message body]_';

  const mediaSection =
    sms.mediaUrls.length > 0
      ? '\n\n**Media:**\n' + sms.mediaUrls.map((url) => `• ${url}`).join('\n')
      : '';

  return {
    content: '@everyone',
    allowed_mentions: { parse: ['everyone'] },
    embeds: [
      {
        title: '🔔 New Trade Alert',
        description: body + mediaSection,
        color: 0x57f287, // green
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
