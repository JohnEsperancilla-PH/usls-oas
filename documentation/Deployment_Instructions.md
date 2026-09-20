# USLS OASYS — Deployment Instructions

This document describes how the USLS Online Appointment System (OASYS) is hosted, how it gets to production, and how the subdomain is wired.

---

## 1. Deployment platform

The application is deployed on **Vercel** using the Next.js framework adapter (no Docker, no custom server).

- **Production URL:** `https://oasys.usls.edu.ph`
- **Preview/draft URLs:** Vercel automatically assigns `*.vercel.app` preview aliases per branch/deployment.

---

## 2. How the app is hosted

| Layer | Provider | Notes |
|---|---|---|
| Web app (Next.js) | Vercel | Serverless functions run the API routes; static pages server-rendered/server-side rendered. |
| Database | Supabase (Postgres) | All application data. |
| Auth | Supabase Auth | Login sessions for admins, gate users, super admins. |
| Email | SMTP (Nodemailer) | Configured via `SMTP_*` environment variables. |
| Calendar | Google Calendar | Service account writes events to `appointment@usls.edu.ph`. |
| Archive mirror | cPanel MySQL | A legacy college system; upserts a read-only copy of appointments. |

---

## 3. Repository and build

- Git repo with the source in this folder.
- Branch `main` (or the production branch) is connected to the Vercel project.
- **Push-to-deploy:** pushing to the production branch triggers an automatic production deployment.

Build command used by Vercel:
```bash
npm run build
```
Start command (for local preview/production use):
```bash
npm run start
```
Local development:
```bash
npm run dev
```

### Build output

Next.js produces:
- Serverless functions for every API route under `src/app/api/**/route.ts`.
- Prerendered static/ISR pages for public pages where applicable.

---

## 4. Domain and subdomain wiring

### 4.1 The subdomain

`oasys.usls.edu.ph` is a **subdomain of `usls.edu.ph`** pointed at Vercel's infrastructure.

To configure a custom domain in the Vercel dashboard:

1. Open the project → **Settings → Domains**.
2. Add `oasys.usls.edu.ph`.
3. Vercel instructs you to add a **CNAME** record at the DNS provider for `usls.edu.ph`:
   - Host/Name: `oasys`
   - Type: `CNAME`
   - Value/Target: `cname.vercel-dns.com` (the exact target shown by Vercel)
4. Wait for DNS propagation (minutes to a few hours). Vercel will show `Valid Configuration` once DNS resolves.
5. Vercel issues/renews the **TLS certificate** automatically for the custom domain.

> DNS for `usls.edu.ph` is controlled by the university registrar/web team; coordinate with them to add/modify the record.

---

## 5. Required environment variables

Create these in Vercel → Project → **Settings → Environment Variables** (also mirrored to `.env.example` locally).

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public) | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (server only, secret) | `eyJ...` |
| `SMTP_HOST` | SMTP server host | `smtp.usls.edu.ph` |
| `SMTP_PORT` | SMTP port (commonly 587) | `587` |
| `SMTP_USER` | SMTP username | `oasys@usls.edu.ph` |
| `SMTP_PASS` | SMTP password | `********` |
| `EMAIL_FROM` | Sender display | `USLS OASYS <oasys@usls.edu.ph>` |
| `NEXT_PUBLIC_APP_URL` | Public app base URL | `https://oasys.usls.edu.ph` |
| `QR_SECRET` | 64-char random string (action tokens / references) | generate via `openssl rand -hex 32` |
| `MYSQL_HOST` | cPanel MySQL host (archive mirror) | `localhost` / host |
| `MYSQL_USER` | MySQL user | `usls_oas` |
| `MYSQL_PASSWORD` | MySQL password | `********` |
| `MYSQL_DATABASE` | MySQL database | `usls_oas_appointments` |
| `MYSQL_SSL` | `true`/`false` | `false` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google service account email | `...@...iam.gserviceaccount.com` |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Multi-line private key (with `\n`) | `-----BEGIN PRIVATE KEY-----...` |
| `GOOGLE_CALENDAR_ID` | Target calendar | `appointment@usls.edu.ph` |
| `GOOGLE_CALENDAR_AS` | Impersonated owner (domain-wide delegation) | `appointment@usls.edu.ph` |
| `CRON_HEALTH_TOKEN` | Token for the `/api/health` keep-alive | `usls-oas-2026` |

> Secrets never live in the repo; only `.env.example` (placeholders) is committed. Never commit `.env.local`.

---

## 6. Deploying changes (step by step)

```bash
# 1. Pull latest
git pull

# 2. Install dependencies if changed
npm install

# 3. Verify build locally
npm run build

# 4. Commit to production branch
git add -A
git commit -m "description of changes"
git push origin main
```

Vercel then deploys automatically. Confirm success in the Vercel **Deployments** tab (green = production, red = failed).

### Database migrations

Schema changes are plain SQL files in `supabase/migrations/`. Apply them to Supabase (SQL editor / Supabase CLI) **before** or together with the code deploy, in order:

```bash
# Option A: Supabase CLI
supabase db push

# Option B: manually paste each migration into the Supabase SQL editor, in numeric order.
```

---

## 7. Keeping the app warm / health monitoring

The `/api/health?token=<CRON_HEALTH_TOKEN>` endpoint is designed for an external scheduler. Configure e.g. **cron-job.org**:

- URL: `https://oasys.usls.edu.ph/api/health?token=usls-oas-2026`
- Frequency: every 10–15 minutes.
- Purpose: keeps the serverless instance warm and records DB liveness in `app_health`.

---

## 8. Rollback / reverting

To roll back a bad deployment:
- Vercel **Deployments** tab → select the last known-good deployment → **Promote to Production** (or use the three-dot menu → Promote).
- If a previous deployment's environment variables changed, restore them in Settings first.

---

## 9. Post-deploy checklist

- [ ] `https://oasys.usls.edu.ph` loads (HTTPS valid).
- [ ] Public booking form loads offices and shows availability.
- [ ] `/admin/login` works and an admin can sign in.
- [ ] `/entry` gate station works with a gate-user account.
- [ ] Test email route disabled in production (it returns 404 in prod).
- [ ] New environment variables applied (Vercel redeploys required after env change).
- [ ] Any new migrations applied to Supabase and `src/types/database.ts` matches.

---

## 10. Common issues

| Symptom | Likely cause | Fix |
|---|---|---|
| 500 `Internal server error` on dashboards | Missing env var, or required env not redeployed | Add env var in Vercel, redeploy |
| Booking shows `Office not found` | `offices.active=false` or missing seed | Check Offices page / office seed |
| Clock/date wrong on gate | Vercel virtual clock vs `Asia/Manila` | System already uses `Asia/Manila`; verify envs not overriding |
| `QR_SECRET` value error | missing / default secret | generate strong secret, redeploy |
| Emails not sending | SMTP envs misconfigured | verify `SMTP_*`, test via Settings |
| Calendar events missing | Google service account/cache misplaced | verify `GOOGLE_*` envs and calendar id |
| cPanel mirror empty | MySQL access | verify `MYSQL_*` envs; mirror failures are non-blocking by design |