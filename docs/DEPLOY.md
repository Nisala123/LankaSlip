# LankaSlip — go live (no credit card)

Railway and Render free tiers now ask for a card. Use this stack instead:

| Piece | Free service | Card required? |
| --- | --- | --- |
| Code | GitHub | No |
| Database | [Neon](https://neon.tech) (already set up) | No |
| App hosting | [Vercel Hobby](https://vercel.com) | No |

On Vercel, SMS is sent **inside the API request** (sync mode). No separate
worker service is needed.

> Vercel Hobby is for personal / non-commercial use. If this becomes a paid
> shop product, upgrade to Vercel Pro later (or move to a paid VPS).

## 1. Neon (already done)

Your project already has a Neon database. Copy `DATABASE_URL` from `.env` or the
Neon console.

## 2. Deploy on Vercel

1. Open [vercel.com](https://vercel.com) and sign in with GitHub (Hobby = free).
2. **Add New Project** → import `Nisala123/LankaSlip`.
3. Framework: Next.js (auto-detected).
4. Add environment variables:

```env
DATABASE_URL=postgresql://...neon.tech/...sslmode=require
APP_URL=https://YOUR-PROJECT.vercel.app
BETTER_AUTH_URL=https://YOUR-PROJECT.vercel.app
BETTER_AUTH_SECRET=paste-openssl-rand-base64-32
DISPATCH_CHANNEL=sms
DISPATCH_MODE=sync
NOTIFY_LK_USER_ID=...
NOTIFY_LK_API_KEY=...
NOTIFY_LK_SENDER_ID=NotifyDEMO
SEED_OWNER_EMAIL=you@example.com
SEED_OWNER_PASSWORD=strong-password
SEED_SHOP_NAME=Your Shop
```

`DISPATCH_MODE=sync` is auto-detected on Vercel, but set it explicitly anyway.

5. Deploy.
6. After the first successful deploy, run schema + seed **once** from your laptop
   against Neon (already done if you finished Neon setup). If you need to re-seed:

```bash
# uses DATABASE_URL from .env pointing at Neon
npm run db:push
npm run db:seed
```

7. Open `https://YOUR-PROJECT.vercel.app/login` and sign in.

## 3. Custom domain (optional)

In Vercel → Project → Domains, add your domain, then update:

```env
APP_URL=https://your-domain.com
BETTER_AUTH_URL=https://your-domain.com
```

Redeploy so SMS links use that domain.

## 4. Checklist

- [ ] Neon `DATABASE_URL` set in Vercel
- [ ] `APP_URL` / `BETTER_AUTH_URL` match the live HTTPS URL
- [ ] Notify.lk credentials set
- [ ] Owner can log in
- [ ] Test SMS to your phone
- [ ] **Share on WhatsApp** works as free fallback

## 5. Local development

```env
DISPATCH_MODE=queue   # optional; uses pg-boss worker
# or
DISPATCH_MODE=sync    # same behaviour as Vercel
```

## 6. If Vercel also blocks you

Alternatives that are usually free without a card for small apps:

1. Keep using **localhost + Cloudflare Tunnel** (`cloudflared`) for demos
2. **Netlify** free (similar serverless limits; may need adapter work)
3. A cheap VPS later (Hetzner / DigitalOcean) when you can pay ~$4–6/month
