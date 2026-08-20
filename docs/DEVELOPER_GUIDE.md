# LankaSlip developer setup guide

Primary delivery is **Notify.lk SMS**. **Share on WhatsApp** opens a prefilled
`wa.me` chat (manual send, no Meta API). Meta WhatsApp Cloud API remains an
optional advanced channel.

## Why customers are not getting messages

Check `DISPATCH_CHANNEL` in `.env`:

| Value | Behaviour |
| --- | --- |
| `sms` | Sends via Notify.lk (needs credentials) |
| `stub` | Simulates send only — no SMS leaves the server |
| `whatsapp` | Meta Cloud API templates (heavy setup) |

Also confirm:

1. The worker is running (`[lankaslip] send-receipt worker started`)
2. `APP_URL` is a **public HTTPS** URL if customers must open the receipt link
   from their phone (localhost links work only on your machine)
3. For SMS: `NOTIFY_LK_USER_ID` and `NOTIFY_LK_API_KEY` are set

## 1. Prerequisites

- Node.js 20 or newer
- npm
- PostgreSQL 16 (local installation or Docker)
- A [Notify.lk](https://www.notify.lk/) account with API access
- Optional: Cloudflare Tunnel / public domain for receipt links
- Optional: Cloudflare R2 for production slip storage
- Optional: Meta WhatsApp Cloud API (not required for SMS or manual share)

## 2. Local application setup

```bash
npm install
cp .env.example .env
docker compose up -d
npm run db:push
npm run db:seed
npm run dev
```

If PostgreSQL is already running locally, Docker is unnecessary. Create the
database/user or change `DATABASE_URL` to match the existing database.

Open `http://localhost:3000`. The development login comes from:

```env
SEED_OWNER_EMAIL=owner@lankaslip.local
SEED_OWNER_PASSWORD=your-development-password
```

Run `npm run db:seed` again after changing either value. Reseeding synchronizes
the existing development owner's password.

Generate a strong secret:

```bash
openssl rand -base64 32
```

## 3. Worker setup

Receipt creation places a job in PostgreSQL. A worker must process that job.

During normal `npm run dev`, Next.js instrumentation starts the worker. For a
separate process deployment, run:

```bash
SKIP_WORKER=1 npm run dev
npm run worker
```

Use only one worker-start method per environment. If a receipt remains
`Sending`, verify the worker terminal has:

```text
[lankaslip] send-receipt worker started
```

## 4. Notify.lk SMS (primary channel)

1. Create an account at [Notify.lk](https://www.notify.lk/).
2. Open the developer/settings page and copy **User ID** and **API key**.
3. For testing, use sender ID `NotifyDEMO` (case-sensitive).
4. For production, request an approved **Sender ID** that matches your brand.
5. Top up SMS credit if needed.

Configure `.env`:

```env
DISPATCH_CHANNEL=sms
NOTIFY_LK_USER_ID=your_user_id
NOTIFY_LK_API_KEY=your_api_key
NOTIFY_LK_SENDER_ID=NotifyDEMO
APP_URL=https://YOUR_PUBLIC_DOMAIN
BETTER_AUTH_URL=https://YOUR_PUBLIC_DOMAIN
```

Restart `npm run dev` (and `npm run worker` if separate).

### SMS content

LankaSlip sends a short text such as:

```text
Demo Shop: LKR 1,250.50 confirmed (LS-20260820-0001). View: https://.../r/...
```

or, when pending:

```text
Demo Shop: LKR 1,250.50 pending (LS-...). Pay / view: https://.../r/...
```

The customer opens the link for the full receipt, slip image, bank details, and
LankaQR.

### Test without spending credit

```env
DISPATCH_CHANNEL=stub
```

The UI shows **Simulated**. Receipt pages still work.

### Manual Notify.lk smoke test

```bash
curl -X POST "https://app.notify.lk/api/v1/send" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "user_id=YOUR_ID&api_key=YOUR_KEY&sender_id=NotifyDEMO&to=9477XXXXXXX&message=LankaSlip%20test"
```

A success response looks like:

```json
{ "status": "success", "data": "Sent" }
```

## 5. Manual WhatsApp share (free fallback)

No Meta Business verification is required.

After a receipt is created, each history card includes **Share on WhatsApp**.
That opens:

```text
https://wa.me/9477XXXXXXX?text=...
```

with the same short receipt text and public URL. The vendor taps **Send** in the
WhatsApp app.

Use this when:

- Notify.lk is down or out of credit
- The customer prefers WhatsApp
- You are still waiting on Sender ID approval

## 6. Public HTTPS for receipt links

SMS and WhatsApp share both include `APP_URL/r/{token}`. Customers cannot open
`http://localhost:3000`.

For local demos:

```bash
cloudflared tunnel --url http://localhost:3000
```

Set `APP_URL` and `BETTER_AUTH_URL` to the HTTPS tunnel URL, then restart the
app.

## 7. Cloudflare R2 slip storage

Local development falls back to ignored files under `data/uploads`. Production
instances with ephemeral disks must use R2.

```env
R2_ACCOUNT_ID=YOUR_CLOUDFLARE_ACCOUNT_ID
R2_ACCESS_KEY_ID=YOUR_R2_ACCESS_KEY
R2_SECRET_ACCESS_KEY=YOUR_R2_SECRET
R2_BUCKET=lankaslip
R2_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
```

## 8. Production deployment

Railway or Fly.io fits better than web-only serverless because LankaSlip uses a
PostgreSQL-backed worker.

- Build: `SKIP_WORKER=1 npm run build`
- Web: `SKIP_WORKER=1 npm run start`
- Worker: `npm run worker`
- Shared PostgreSQL
- Secrets from the platform (never commit `.env`)
- Stable custom HTTPS domain as `APP_URL`

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

## 9. Optional: Meta WhatsApp Cloud API

Only needed for fully automated WhatsApp (no manual tap). Prefer Notify.lk for
v1.

High-level requirements if you enable it later:

1. Meta Business verification + WABA + display name
2. Approved Utility templates (`lankaslip_paid`, `lankaslip_pending`, media variants)
3. Permanent system-user token
4. Public webhook at `/api/webhooks/whatsapp`
5. `DISPATCH_CHANNEL=whatsapp` and all `WHATSAPP_*` env vars

Template bodies expected by the adapter:

- Paid: `{{1}} confirmed LKR {{2}} ({{3}}). Tap to view your receipt.`
- Pending: `{{1}}: LKR {{2}} is pending ({{3}}). Pay / view receipt:`
- URL button: `https://YOUR_PUBLIC_DOMAIN/r/{{1}}`

System user token permissions:

- `business_management`
- `whatsapp_business_messaging`
- `whatsapp_business_management`

Webhook verify token must match `WHATSAPP_VERIFY_TOKEN`. Subscribe to `messages`.

## 10. Troubleshooting

### UI shows Failed after Send SMS

- Missing / wrong `NOTIFY_LK_USER_ID` or `NOTIFY_LK_API_KEY`
- Wrong sender ID (demo is exactly `NotifyDEMO`)
- Insufficient Notify.lk balance
- Invalid recipient format (must be Sri Lankan mobile)

### UI stays Sending

- Worker not running
- Web and worker using different `DATABASE_URL`

### SMS arrives but link does not open

- `APP_URL` is still `http://localhost:3000`
- Tunnel URL expired — update Meta/env and recreate receipt

### Share on WhatsApp opens chat but nothing is automated

Expected. Manual share is a free fallback; the vendor must tap Send.

### Simulated instead of SMS

`DISPATCH_CHANNEL=stub` — switch to `sms` and restart.

## 11. Quality checks

```bash
npx tsc --noEmit
npx eslint src
SKIP_WORKER=1 npm run build
```
