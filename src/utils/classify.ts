export type TradeAction = 'long' | 'short' | 'close' | 'sl_update' | 'commentary';

export interface ActionConfig {
  color: number;
  emoji: string;
  label: string;
}

export const ACTION_CONFIG: Record<TradeAction, ActionConfig> = {
  long: { color: 0x57f287, emoji: '📈', label: 'Long Entry' },
  short: { color: 0xed4245, emoji: '📉', label: 'Short Entry' },
  close: { color: 0xfee75c, emoji: '💰', label: 'Close / Take Profit' },
  sl_update: { color: 0xff9900, emoji: '🛡️', label: 'SL Update' },
  commentary: { color: 0x5865f2, emoji: '💬', label: 'Update' },
};

export function classifyTradeMessage(body: string): TradeAction {
  const t = body.toLowerCase();

  // Close / take profit — specific phrases only to avoid false positives
  if (
    /\b(close\s+all|close\s+this|sell\s+all|selling\s+off|sell\s+\d+%|take\s+\d+%|set\s+tp|tp\s+at|book.*profit|taking.*off)\b/.test(
      t,
    )
  ) {
    return 'close';
  }
  // "close" alone only when it's the whole message or starts the message
  if (/^close[\s.,!]*$/.test(t.trim())) {
    return 'close';
  }

  // Stop loss update
  if (
    /\b(sl\s+to|move\s+sl|change\s+sl|set\s+(all\s+)?stops?|stops?\s+to|stop\s+loss\s+to)\b/.test(t)
  ) {
    return 'sl_update';
  }

  // Long entry
  if (
    /\b(open\s+long|opened\s+(here|long|another|more)|long\b|longs\b|for\s+longs|get.*rdy.*long)\b/.test(
      t,
    )
  ) {
    return 'long';
  }

  // Short entry
  if (/\b(open\s+short|opened\s+short|short\b|shorts\b|sl\s+short)\b/.test(t)) {
    return 'short';
  }

  return 'commentary';
}
