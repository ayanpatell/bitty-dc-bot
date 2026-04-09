# bitty-dc-bot

A lightweight, one-way SMS-to-Discord bridge. Text a Telnyx phone number and the message appears in a Discord channel.

```
You → SMS → Telnyx → inbound webhook → this server → Discord channel
```

---

## Why Telnyx

Telnyx lets you buy a phone number and start receiving SMS immediately, with no A2P/10DLC registration required for basic inbound-only use. This makes it the fastest path to a working personal SMS bridge compared to providers that require business registration or campaign approval before you can receive a single test message.

---

## Architecture

```
Telnyx phone number
       │  SMS received
       ▼
Telnyx sends HTTP POST (JSON) to your webhook URL
       │
       ▼
POST /webhook/telnyx
  ├─ express.raw() captures raw body (required for signature verification)
  ├─ ED25519 signature verified against your Telnyx public key
  ├─ Replay attack check (5-minute timestamp window)
  ├─ JSON payload parsed: from, to, body, media
  ├─ Sender checked against ALLOWED_FROM_NUMBERS allowlist
  └─ Allowed? → POST to Discord channel webhook
```

No database. No queue. No state. Returns `200` within 2 seconds (Telnyx's timeout).

---

## Required Accounts

1. **Telnyx** — [telnyx.com](https://telnyx.com)
   - Buy a phone number (starts at ~$1/month)
   - Find your webhook public key in Mission Control → Keys & Credentials

2. **Discord** — any server where you have Manage Webhooks permission
   - Create an incoming webhook on any text channel

---

## Setup

### 1. Clone and install

```bash
git clone <your-repo>
cd bitty-dc-bot
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Required | Where to find it |
|----------|----------|-----------------|
| `TELNYX_PUBLIC_KEY` | **Yes** | Mission Control → Keys & Credentials → Public Key |
| `DISCORD_WEBHOOK_URL` | **Yes** | Discord channel → Edit Channel → Integrations → Webhooks |
| `ALLOWED_FROM_NUMBERS` | No | Your own phone number(s) in E.164 format |
| `PORT` | No (3000) | Any available port |
| `NODE_ENV` | No | `development` / `production` |
| `LOG_LEVEL` | No (info) | `trace`, `debug`, `info`, `warn`, `error` |

> **Important:** `TELNYX_PUBLIC_KEY` is your webhook signing key, not your API key. It is the base64-encoded Ed25519 public key from the Keys & Credentials page.

### 3. Configure your Telnyx phone number

1. Go to [Mission Control Portal](https://portal.telnyx.com)
2. Navigate to **Messaging** → **Programmable Messaging**
3. Create or select a Messaging Profile
4. Under the profile settings, set the **Webhook URL** to:
   ```
   https://your-app-domain.com/webhook/telnyx
   ```
5. Assign your phone number to this Messaging Profile:
   - Go to **Numbers** → select your number → assign it to the profile

> For local development, see the ngrok section below.

### 4. Create a Discord channel webhook

1. Open Discord and go to the channel you want SMS messages forwarded to
2. Click the gear icon → **Integrations** → **Webhooks** → **New Webhook**
3. Give it a name (e.g., "SMS Bridge")
4. Click **Copy Webhook URL**
5. Paste the URL into your `.env` as `DISCORD_WEBHOOK_URL`

---

## Running Locally

```bash
npm run dev
```

The server starts on `http://localhost:3000`. You should see:

```
[INFO] Server started {"port":3000,"env":"development"}
```

### Health check

```bash
curl http://localhost:3000/health
# {"status":"ok","ts":"2024-01-15T20:16:07.503Z"}
```

---

## Local Testing with ngrok

To receive real Telnyx webhooks on your local machine:

### 1. Install ngrok

```bash
brew install ngrok
# or download from https://ngrok.com
```

### 2. Start your dev server

```bash
npm run dev
```

### 3. Open a tunnel

```bash
ngrok http 3000
```

ngrok prints a public URL like `https://abc123.ngrok.io`.

### 4. Update Telnyx webhook URL

In Mission Control → your Messaging Profile → Webhook URL:
```
https://abc123.ngrok.io/webhook/telnyx
```

### 5. Send a test SMS

Text your Telnyx number from a number in your `ALLOWED_FROM_NUMBERS` list. The message should appear in your Discord channel within a second or two.

---

## Manual Webhook Test (curl)

You can send a raw test webhook from the command line. You'll need to compute a valid ED25519 signature, which requires your private key. The easiest way to test without a real signature is to temporarily skip signature validation in development by checking the code — but for proper integration testing, use a real Telnyx number.

Here's the shape of a valid Telnyx inbound SMS event if you want to study the payload:

```json
{
  "data": {
    "event_type": "message.received",
    "id": "b301ed3f-1490-491f-995f-6e64e69674d4",
    "record_type": "event",
    "payload": {
      "id": "84cca175-9755-4859-b67f-4730d7f58aa3",
      "from": { "phone_number": "+13125550001" },
      "to": [{ "phone_number": "+17735550002" }],
      "text": "Hello from my phone",
      "media": [],
      "type": "SMS",
      "received_at": "2024-01-15T20:16:07.503+00:00"
    }
  },
  "meta": { "attempt": 1, "delivered_to": "https://your-app.com/webhook/telnyx" }
}
```

---

## Deployment

### Render

1. Push to a GitHub repo
2. Create a new **Web Service** on [render.com](https://render.com)
3. Connect your repo
4. Set:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Environment**: Node
5. Add all environment variables in the Render dashboard
6. Deploy
7. Use the assigned `.onrender.com` URL as your Telnyx webhook URL
8. Set `NODE_ENV=production`

**Free tier note:** Render's free tier spins down after 15 minutes of inactivity, causing cold starts that may exceed Telnyx's 2-second webhook timeout. Use the Starter plan ($7/month) or Railway for reliability.

### Railway

1. Push to GitHub
2. Create a new project on [railway.app](https://railway.app) from your repo
3. Railway auto-detects Node.js and runs `npm run build` + `npm start`
4. Add environment variables in the Railway dashboard
5. Railway provides a permanent public URL — use it as your Telnyx webhook URL
6. Set `NODE_ENV=production`

Railway does not spin down on inactivity (on paid plans), making it better for latency-sensitive webhooks.

---

## Discord Message Format

Messages appear in Discord as embedded cards:

```
┌─────────────────────────────────────┐
│  New SMS                            │
│                                     │
│  ```                                │
│  Hello from my phone                │
│  ```                                │
│                                     │
│  From: +13125550001  To: +17735550002│
│                                     │
│  ID: 84cca175-9755-...              │
└─────────────────────────────────────┘
```

If the message contains media (MMS), the media URLs are listed below the text.

---

## Security

### Webhook signature verification

Every inbound request is verified using ED25519 signature validation before any processing occurs. Requests without a valid `telnyx-signature-ed25519` header are rejected with `403 Forbidden`.

The signing algorithm:
1. Telnyx signs `{timestamp}|{raw_request_body}` with its private key
2. This server verifies using your public key (from Mission Control)
3. Requests older than 5 minutes are rejected to prevent replay attacks

### Sender allowlist

Only phone numbers in `ALLOWED_FROM_NUMBERS` are forwarded to Discord. Messages from other numbers are silently ignored — the server returns `200` to Telnyx (so it doesn't retry) but does not forward anything.

### What is NOT protected

- **Rate limiting**: If someone sends many messages from an allowlisted number, they all get forwarded. Consider adding rate limiting if needed.
- **Replay within 5 minutes**: The timestamp window is 5 minutes. An attacker who captures a valid webhook could replay it within that window. This is a standard tradeoff.
- **Discord webhook URL exposure**: If your Discord webhook URL leaks, anyone can post to your channel. Treat it as a secret.

### Secret management

- Never commit `.env` to version control (it is in `.gitignore`)
- Rotate your Telnyx public key if you suspect it was exposed
- Use your platform's secret management (Render Environment Variables, Railway Variables) in production

---

## Troubleshooting

**`Missing required environment variables`**
Check that your `.env` file exists and contains `TELNYX_PUBLIC_KEY` and `DISCORD_WEBHOOK_URL`.

**`Invalid Telnyx signature — rejecting request`**
- Make sure `TELNYX_PUBLIC_KEY` is the signing public key (from Keys & Credentials), not your API key
- Verify the webhook URL in Telnyx matches the URL the server is actually reachable at
- If testing locally, make sure you're using the ngrok URL in Telnyx, not `localhost`

**Messages from allowlisted numbers not appearing in Discord**
- Check `ALLOWED_FROM_NUMBERS` uses E.164 format: `+14155551234`
- Check logs for `Sender not in allowlist` messages
- Verify the Discord webhook URL is correct and the channel exists

**Discord calls failing**
- The server returns `500` when Discord rejects a webhook call, which causes Telnyx to retry
- Check that the Discord channel and webhook still exist
- Check the Discord webhook URL hasn't been regenerated

**Telnyx retries delivering the same message**
- This happens when your server returns a non-`2xx` response or times out
- The server must respond within 2 seconds. Check for slow Discord calls or cold starts.

---

## Development Scripts

```bash
npm run dev          # Start with hot reload (tsx watch)
npm run build        # Compile TypeScript to dist/
npm start            # Run compiled server (production)
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run typecheck    # TypeScript type check (no emit)
npm run lint         # ESLint on src/
```

---

## Project Structure

```
src/
  config/index.ts          # Environment variable loading + startup validation
  providers/telnyx/
    parser.ts              # Parses Telnyx JSON webhook payload → ParsedSms
    validator.ts           # ED25519 signature verification
  routes/
    health.ts              # GET /health
    telnyx.ts              # POST /webhook/telnyx (orchestrator + middleware)
  services/discord.ts      # Discord webhook client + message formatter
  types/index.ts           # Shared TypeScript types
  utils/
    allowlist.ts           # Sender allowlist check + parser
    logger.ts              # Pino structured logger
  app.ts                   # Express app factory
  server.ts                # Entry point (dotenv → config → listen)

tests/
  allowlist.test.ts        # Unit: allowlist logic
  formatter.test.ts        # Unit: payload parsing + Discord formatting
  telnyx-handler.test.ts   # Integration: full signed HTTP request handling
```
