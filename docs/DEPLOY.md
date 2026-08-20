# LankaSlip — go live (GitHub + Railway)

LankaSlip needs a **web** process, a **worker** process, and **PostgreSQL**.
Railway is the recommended host.

## 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial LankaSlip release"
gh repo create LankaSlip --private --source=. --remote=origin --push
```

Or create an empty repo on github.com, then:

```bash
git remote add origin https://github.com/YOUR_USER/LankaSlip.git
git branch -M main
git push -u origin main
```

Never commit `.env`. Only `.env.example` is tracked.

## 2. Deploy on Railway

1. Open [railway.app](https://railway.app) and sign in with GitHub.
2. **New Project → Deploy from GitHub** → select `LankaSlip`.
3. Add a **PostgreSQL** plugin/service to the project.
4. In the web service variables, set at least:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
APP_URL=https://YOUR_RAILWAY_DOMAIN
BETTER_AUTH_URL=https://YOUR_RAILWAY_DOMAIN
BETTER_AUTH_SECRET=generate-with-openssl-rand-base64-32
DISPATCH_CHANNEL=sms
NOTIFY_LK_USER_ID=...
NOTIFY_LK_API_KEY=...
NOTIFY_LK_SENDER_ID=NotifyDEMO
SEED_OWNER_EMAIL=you@example.com
SEED_OWNER_PASSWORD=strong-password
SEED_SHOP_NAME=Your Shop
SKIP_WORKER=1
```

5. Set the web service start command to:

```bash
npm run start:web
```

Build command:

```bash
npm run build
```

6. Add a **second service** from the same GitHub repo for the worker:
   - Start command: `npm run worker`
   - Same `DATABASE_URL` and Notify.lk / auth env vars
   - Do **not** set `SKIP_WORKER` on this service (or leave unset)

7. After first deploy, run once (Railway shell or one-off):

```bash
npm run db:push
npm run db:seed
```

8. Attach a custom domain if you have one, then update `APP_URL` and
   `BETTER_AUTH_URL` to that HTTPS domain.

## 3. Production checklist

- [ ] `DISPATCH_CHANNEL=sms` with real Notify.lk credentials
- [ ] Approved Sender ID (not only `NotifyDEMO`) for production traffic
- [ ] Strong `BETTER_AUTH_SECRET` and owner password
- [ ] Public `APP_URL` so SMS receipt links open on customer phones
- [ ] Worker service is running (SMS stays "Sending" if it is not)
- [ ] Optional R2 vars for slip storage on ephemeral disks

## 4. Verify

1. Open `APP_URL/login` and sign in with the seeded owner.
2. Send a test receipt to your phone.
3. Confirm SMS arrives and `/r/{token}` opens.
4. Use **Share on WhatsApp** as the free fallback.
