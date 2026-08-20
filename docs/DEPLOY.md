# LankaSlip — go live (GitHub + Render + Neon)

Railway trial expired? Use this **free** stack instead:

| Piece | Free service |
| --- | --- |
| Code | GitHub (`Nisala123/LankaSlip`) |
| App + SMS worker | [Render](https://render.com) free Web Service |
| Database | [Neon](https://neon.tech) free Postgres |

Render’s free tier does **not** include background workers, so LankaSlip runs the
queue worker **inside** the web process (default `npm run start`). That is fine
for a small shop. The free web service **sleeps after ~15 minutes** of no
traffic; the first request after sleep can take ~30–60s.

## 1. Create a free Neon database

1. Sign up at [neon.tech](https://neon.tech) with GitHub.
2. Create a project (region close to Sri Lanka / Singapore if available).
3. Copy the connection string (`DATABASE_URL`, use the pooled URL if Neon shows one).

## 2. Deploy the app on Render

1. Sign up at [render.com](https://render.com) with GitHub.
2. **New → Blueprint** and select repo `LankaSlip`, **or**
   **New → Web Service** → connect `Nisala123/LankaSlip`.
3. Settings:

| Field | Value |
| --- | --- |
| Runtime | Node |
| Branch | `main` |
| Build command | `npm ci && npm run build` |
| Start command | `npm run start` |
| Instance type | **Free** |

Important: use `npm run start` (not `start:web`) so the SMS worker starts with
the app. Do **not** set `SKIP_WORKER=1` on this free deploy.

4. Add environment variables:

```env
DATABASE_URL=postgresql://...neon.tech/...
APP_URL=https://YOUR-SERVICE.onrender.com
BETTER_AUTH_URL=https://YOUR-SERVICE.onrender.com
BETTER_AUTH_SECRET=paste-openssl-rand-base64-32
DISPATCH_CHANNEL=sms
NOTIFY_LK_USER_ID=...
NOTIFY_LK_API_KEY=...
NOTIFY_LK_SENDER_ID=NotifyDEMO
SEED_OWNER_EMAIL=you@example.com
SEED_OWNER_PASSWORD=strong-password
SEED_SHOP_NAME=Your Shop
```

Generate a secret locally:

```bash
openssl rand -base64 32
```

5. Deploy. When the service is live, open the Render **Shell** (or one-off) and run:

```bash
npm run db:push
npm run db:seed
```

6. Open `APP_URL/login` and sign in with the seeded owner.

## 3. After you get a custom domain

Update both:

```env
APP_URL=https://your-domain.com
BETTER_AUTH_URL=https://your-domain.com
```

Redeploy (or restart) so SMS receipt links use the public domain.

## 4. Production checklist

- [ ] Neon `DATABASE_URL` set
- [ ] `APP_URL` / `BETTER_AUTH_URL` match the live HTTPS URL
- [ ] Notify.lk credentials set (`DISPATCH_CHANNEL=sms`)
- [ ] `npm run db:push` + `npm run db:seed` completed
- [ ] Test SMS to your phone
- [ ] Optional: Cloudflare R2 for slip images (Render free disk is ephemeral)

## 5. Free-tier behaviour to expect

- First visit after idle sleep can be slow (cold start).
- SMS sends while the service is awake; after long idle, open the site once
  before sending if a job seems stuck.
- Neon free tier stays available; Render free Postgres (if you use it instead)
  expires after 30 days — prefer Neon.

## 6. Optional later upgrades

- Paid Render worker service for an always-on queue
- Custom domain on Render
- R2 for slip storage
