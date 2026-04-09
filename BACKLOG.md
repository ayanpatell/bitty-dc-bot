# V2 Backlog

Ordered roughly by impact/effort ratio. High impact, low effort first.

---

## P1 — High Impact, Low Effort

**Rate limiting per sender**
Reject or queue messages if a single number sends more than N messages per minute. Prevents Discord channel spam. Use an in-memory token bucket (no database needed for single-instance deployments). Library: `express-rate-limit` or a small custom implementation.

**Duplicate delivery protection**
Telnyx may deliver the same webhook twice if the server returns a 5xx or times out. Store `data.id` (the event ID) in a short-lived in-memory LRU cache and skip reprocessing if seen recently. No database needed — an LRU with a 10-minute TTL and max 1000 entries is enough for low-volume use.

**Configurable log level per environment**
Already supported via `LOG_LEVEL`. Document that setting `LOG_LEVEL=debug` enables full payload logging, and that it should never be set to `debug` in production because it logs message bodies.

---

## P2 — High Impact, Medium Effort

**Twilio provider support**
Add `src/providers/twilio/` alongside the existing Telnyx provider. Define a thin `InboundSmsProvider` interface (parse + validate) and make the route generic. The route handler already delegates to provider modules — the abstraction is naturally there. The main work is implementing Twilio's HMAC-SHA1 signature validation and form-encoded body parsing.

**Sender-to-channel routing**
Support multiple Discord channels. Map specific phone numbers (or area codes, or patterns) to different Discord webhook URLs. Config format:
```
ROUTING=+14155551234:https://discord.com/.../channelA,+12125559876:https://discord.com/.../channelB
DISCORD_WEBHOOK_URL=https://...  # fallback for unmatched senders
```
Keep it env-var-based for simplicity; no admin UI needed.

**Media download and re-upload**
Telnyx MMS media URLs expire and require authentication. Currently the bot only notes that media was received. To actually display images in Discord: download the media bytes from Telnyx (using the API key), upload them as `multipart/form-data` attachments to the Discord webhook. This makes MMS images actually viewable in Discord.

---

## P3 — Medium Impact, Medium Effort

**Structured error alerting**
Send a Discord message (to a separate admin channel) when the bot encounters a repeated Discord delivery failure. Currently failures are only logged. A simple threshold — "N consecutive failures → send alert to admin webhook" — would make monitoring possible without external tools.

**Request ID / correlation ID header**
Add `x-request-id` or use Telnyx's `meta.attempt` to correlate log lines across a single webhook delivery attempt. Already partially done via child loggers with `messageId`, but a per-request UUID would help with parallel processing.

**Configurable Discord embed theme per sender**
Allow each sender number to have a custom embed color or label. Useful when the bridge serves multiple people in a household or team.

---

## P4 — Lower Priority / Future

**Persistent delivery log**
Log every forwarded message to a SQLite or Postgres database. Enables: replay, audit, deduplication across restarts, admin dashboard. Use Prisma or Drizzle for the schema. Adds a deployment dependency but unlocks many features.

**Admin dashboard / web UI**
A small read-only web UI showing recent messages, delivery status, and allowlist management. Requires a database. Could be a simple Next.js app or a plain HTML file served by Express.

**Two-way messaging**
Send replies from Discord back to the SMS sender. Requires: a Discord bot token (not just an incoming webhook), reading Discord messages, and calling the Telnyx Messages API to send outbound SMS. This is a significantly larger feature that changes the security model of the Discord integration.

**Telnyx Messaging Profile webhook failover**
Configure a secondary URL in Telnyx as the failover webhook. If the primary server is down or returns non-2xx, Telnyx automatically retries against the failover. This could be a second Render region or a simple Cloud Function.

**Cloudflare Workers port**
The app is structured to be serverless-friendly (pure functions, no persistent state). A Workers port would give near-zero cold starts and global edge deployment. The main blocker is that `crypto.subtle.importKey` with `Ed25519` in `'raw'` format is not supported in all Workers runtimes — test compatibility before committing.

**Telnyx webhook delivery dashboard**
Use the Telnyx API to poll for webhook delivery status and surface failed deliveries. Useful during debugging but adds operational complexity.
