import type { DiscordWebhookPayload, ParsedSms } from '../types/index.js';

export function formatDiscordMessage(sms: ParsedSms): DiscordWebhookPayload {
  const bodyBlock = sms.body.length > 0 ? `\`\`\`\n${sms.body}\n\`\`\`` : '_[no text body]_';

  const mediaSection =
    sms.mediaUrls.length > 0
      ? '\n\n**Media:**\n' + sms.mediaUrls.map((url) => `• ${url}`).join('\n')
      : '';

  return {
    embeds: [
      {
        title: 'New Trade Alert',
        description: bodyBlock + mediaSection,
        color: 0x5865f2,
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
