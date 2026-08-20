# LankaSlip

Phone-first receipt dispatch over **Notify.lk SMS**, with a free **manual WhatsApp
share** fallback, tokenized customer receipt pages, pending-payment details, and
LankaQR support.

For complete setup (Notify.lk, WhatsApp Cloud optional, webhooks, storage,
workers), see [`docs/DEVELOPER_GUIDE.md`](docs/DEVELOPER_GUIDE.md).
To push to GitHub and go live, see [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Local setup

```bash
npm install
cp .env.example .env
docker compose up -d
npm run db:push
npm run db:seed
npm run dev
```

Primary channel is SMS:

```env
DISPATCH_CHANNEL=sms
NOTIFY_LK_USER_ID=...
NOTIFY_LK_API_KEY=...
NOTIFY_LK_SENDER_ID=NotifyDEMO
```

Use `DISPATCH_CHANNEL=stub` to develop without sending SMS. After each receipt,
tap **Share on WhatsApp** to open a prefilled `wa.me` message (manual send, no
Meta Business API required).

Seeded login uses `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD`. Run `npm run db:seed`
again after changing them.

## Worker

```bash
npm run worker
```

Next.js also starts the worker through instrumentation unless `SKIP_WORKER=1`.

## Verification

```bash
npx tsc --noEmit
npx eslint src
SKIP_WORKER=1 npm run build
```
