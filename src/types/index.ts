export interface AppConfig {
  port: number;
  nodeEnv: string;
  logLevel: string;
  telnyxPublicKey: string;
  discordWebhookUrl: string;
  allowedFromNumbers: Set<string>;
}

export interface ParsedSms {
  from: string;
  to: string;
  body: string;
  messageId: string;
  mediaUrls: string[];
}

export interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp: string;
}

export interface DiscordWebhookPayload {
  embeds: DiscordEmbed[];
}

// Telnyx inbound webhook payload shape (partial — only fields we use)
export interface TelnyxMediaItem {
  url: string;
  content_type?: string;
}

export interface TelnyxMessagePayload {
  id: string;
  text: string;
  from: { phone_number: string };
  to: Array<{ phone_number: string }>;
  media: TelnyxMediaItem[];
  type: string;
  received_at: string;
}

export interface TelnyxWebhookEvent {
  data: {
    event_type: string;
    id: string;
    payload: TelnyxMessagePayload;
    record_type: string;
  };
  meta: {
    attempt: number;
    delivered_to: string;
  };
}
