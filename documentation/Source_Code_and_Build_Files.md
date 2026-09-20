# USLS OASYS — Source Code and Build Files

This document explains where everything lives in the repository and what each part does. It is organized by folder; each entry explains the purpose of the code inside.

---

## Repository layout (top level)

```
├── src/                    # All application source code
│   ├── app/                # Next.js App Router (pages and API routes)
│   ├── components/         # React components (shared UI)
│   ├── lib/                # Server-side business logic / helpers
│   ├── types/              # TypeScript types (mirrors DB schema)
│   └── middleware.ts       # Edge security headers / CSP
├── supabase/
│   └── migrations/         # SQL schema migrations (001–030)
├── public/                 # Static assets (images, fonts)
├── documentation/          # This documentation
├── .env.example            # Documented environment variables
├── package.json            # Dependencies + scripts
├── next.config.ts          # Next.js configuration
├── tsconfig.json           # TypeScript configuration
├── eslint.config.mjs       # ESLint configuration
└── postcss.config.mjs      # Tailwind/PostCSS configuration
```

---

## 2. `package.json`

Declares the project and dependencies.

- **Scripts:**
  - `npm run dev` → `next dev` (local development server)
  - `npm run build` → `next build` (production build)
  - `npm run start` → `next start` (run the production build)
  - `npm run lint` → `eslint`
- **Dependencies:**
  - `next` (16.3.2), `react` / `react-dom` (19) — app framework.
  - `@supabase/ssr`, `@supabase/supabase-js` — database + auth.
  - `googleapis` — Google Calendar event creation.
  - `nodemailer` — SMTP email sending.
  - `mysql2` — cPanel MySQL archive mirror pool.
  - `pdf-lib` — PDF gate ticket generation.
  - `sharp` — image processing (logo embedding in emails/PDF).
- **Dev dependencies:** TypeScript, ESLint, Tailwind CSS v4, PostCSS.

---

## 3. `src/app` — Pages and API routes (Next.js App Router)

### Public pages

| File | Purpose |
|---|---|
| `src/app/page.tsx` | Landing / booking page. Hosts the multi-step booking flow and the Welcome modal. |
| `src/app/offices/page.tsx` | Public office directory (who you can book an appointment with). |
| `src/app/consent/page.tsx` | Visitor data-consent statement page. |
| `src/app/privacy/page.tsx` | Privacy policy page. |
| `src/app/terms/page.tsx` | Terms of service page. |
| `src/app/cookies/page.tsx` | Cookie policy page. |
| `src/app/entry/page.tsx` | **Gate station.** Gate-user login (employee ID), scan/reference verification, allow/deny entry, checkout, "today's expected visitors" list. |
| `src/app/layout.tsx` | Root layout (fonts, metadata, HTML shell). |
| `src/app/loading.tsx` | Global loading fallback. |
| `src/app/manifest.ts` | PWA-style manifest metadata. |
| `src/app/globals.css` | Tailwind v4 styles + custom classes (`.input`, `.label`, `.btn-primary`, `.skeleton`, etc.). |

### Admin area

| File | Purpose |
|---|---|
| `src/app/admin/layout.tsx` | Admin shell: sidebar navigation, session guard, role-aware nav items (Appointments, Invitations, Contacts, Offices, Accounts, Audit Log, Settings). |
| `src/app/admin/page.tsx` | **Dashboard.** Appointment list + filters, super-admin stats cards, detail modal (approve/decline/postpone/reset-QR), calendar view, block/unblock time slots, per-day slot grid. |
| `src/app/admin/login/page.tsx` | Admin login (Supabase Auth email/password + admin check). |
| `src/app/admin/invitations/page.tsx` | Manual invitations list + "New Invitation" modal + ticket PDF download links. |
| `src/app/admin/contacts/page.tsx` | Office contacts page (office admin) with Add-Contact modal; super admin sees a pointer to the Offices page. |
| `src/app/admin/offices/page.tsx` | Offices CRUD (super admin) + per-office Contacts button. |
| `src/app/admin/accounts/page.tsx` | Admin accounts CRUD (super admin). |
| `src/app/admin/audit/page.tsx` | Read-only audit trail (super admin). |
| `src/app/admin/settings/page.tsx` | System info, booking rules, notification toggles (super admin). |

### API routes (`src/app/api/**`)

Each `route.ts` exports HTTP method handlers. See `API_Documentation.md` for full contracts; a quick map:

| Route | What it does |
|---|---|
| `api/offices` | Public office list. |
| `api/availability` | Public slot/month availability. |
| `api/appointments` | Public booking + auto emails. |
| `api/appointments/approve` | Admin approve (+ reference, email, calendar). |
| `api/appointments/decline` | Admin decline/postpone (+ email). |
| `api/appointments/reset-qr` | Re-issue reference for completed appointments. |
| `api/appointments/email-action` | One-click approve/decline from email links (HMAC token). |
| `api/scan` | Gate verify/allow/deny/checkout + today's list. |
| `api/entry/auth` | Gate login/session check. |
| `api/admin/auth` | Confirm admin dashboard login. |
| `api/admin/appointments` | Dashboard appointment list. |
| `api/admin/offices` | Offices CRUD (super admin). |
| `api/admin/accounts` | Accounts CRUD (super admin). |
| `api/admin/settings` | Settings get/put (super admin write). |
| `api/admin/blocked-times` | Block/unblock time slots. |
| `api/admin/audit` | Audit log list (super admin). |
| `api/admin/invitations` | Invitations list/create (+ PDF email tasks). |
| `api/admin/invitations/[id]/ticket` | PDF ticket download. |
| `api/admin/office-contacts` | Office contacts list/create. |
| `api/admin/office-contacts/[id]` | Office contact update/delete (soft). |
| `api/health` | Cron keep-alive heartbeat. |
| `api/test/email` | Dev-only test email sender (disabled in prod). |

---

## 4. `src/components` — React components

| File | Purpose |
|---|---|
| `src/components/WelcomeModal.tsx` | First-visit informational modal on the booking page. |
| `src/components/forms/AppointmentForm.tsx` | Step 2 booking form: office picker, date, time slot, duration, purpose, summary. |
| `src/components/forms/IdentityForm.tsx` | Step 1 booking form: booker identity + group visitors + vehicles. |
| `src/components/legal/LegalPage.tsx` | Shared layout/rendering helper for the legal pages. |
| `src/components/admin/ModalShell.tsx` | Reusable modal shell (consistent styling across admin modals). |
| `src/components/admin/NewInvitationModal.tsx` | "New Invitation" creation form (contacts tagging, vehicles, group visitors). |
| `src/components/admin/OfficeContactsModal.tsx` | Office contact manager: list + Add/Edit modal + Remove. |

---

## 5. `src/lib` — Server logic and helpers

| File | Purpose |
|---|---|
| `src/lib/rbac.ts` | Auth helpers: `getAuthAdmin`, `requireSuperAdmin`, `requireEntryUser`, `logAudit`. |
| `src/lib/action-token.ts` | HMAC-signed 72-hour approve/decline links embedded in admin alert emails. |
| `src/lib/appointment-actions.ts` | Orchestrates post-status-change side effects: approval/decline/postponement/invitation emails, calendar events, ticket PDF, audit, email_logs. |
| `src/lib/appointment-contacts.ts` | Batch-load tagged contacts (`attachAppointmentContacts`). |
| `src/lib/appointment-vehicles.ts` | Batch-load vehicles per appointment. |
| `src/lib/appointment-visitors.ts` | Batch-load group visitors per appointment. |
| `src/lib/calendar.ts` | Google Calendar event creation via service account (JWT). |
| `src/lib/cpanel-mirror.ts` | Upserts appointments into the cPanel MySQL archive (best-effort). |
| `src/lib/email.ts` | SMTP transport + branded HTML email templates + notification toggles. |
| `src/lib/entry-auth.ts` | Gate identity helpers (`normalizeEmployeeId`, `getGateAuthEmail`). |
| `src/lib/http.ts` | `handleRouteError` / `sanitizeError` (logs without leaking secrets). |
| `src/lib/mysql.ts` | Lazy MySQL connection pool singleton. |
| `src/lib/rate-limit.ts` | In-memory sliding-window rate limiter. |
| `src/lib/reference.ts` | Reference-number generator (Crockford base32, unique probe). |
| `src/lib/secret.ts` | Enforces a real `QR_SECRET`. |
| `src/lib/ticket.ts` | PDF gate ticket generator (pdf-lib). |
| `src/lib/time.ts` | Manila timezone helpers + gate entry timing window (−30/+15 min). |
| `src/lib/valid-ids.ts` | Whitelist of acceptable government-issued IDs. |
| `src/lib/supabase/client.ts` | Browser Supabase client (anon key). |
| `src/lib/supabase/server.ts` | Server Supabase clients: SSR cookie client, route client, service-role client. |

---

## 6. `src/types` — TypeScript types

| File | Purpose |
|---|---|
| `src/types/database.ts` | Interfaces mirroring the Supabase schema: `Office`, `Appointment`, `Admin`, `AuditLog`, `EmailLog`, `BlockedTime`, `OfficeContact`, `AppointmentContact`, visitor/vehicle types, `Database` table map. |

Keeps the codebase in sync with the SQL migrations and gives type safety across API routes and pages.

---

## 7. `src/middleware.ts` — Edge middleware

Runs on every request. Adds security headers:
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.
- `Strict-Transport-Security` (HSTS) when served over HTTPS.
- A `Content-Security-Policy` allowing only self + Supabase.
- `Cache-Control: no-store` on all `/api/*` responses.

---

## 8. `supabase/migrations/` — Database schema

Numbered SQL files (001–030) applied in order. Highlights:

| Range | Content |
|---|---|
| 001–005 | Core schema (offices, appointments, admins, email_logs, audit_logs, blocked_times, visitor fields). |
| 006–017 | Settings, health table, valid ID field, office categories + seed data, FK/cascade tuning. |
| 018–023 | Visitor categories, `gate_user` role, employee IDs, entry/checkout/denial fields. |
| 024–027 | Multi-visitor support + backfill; cPanel visitor mirror. |
| 028–029 | Postponed status, vehicles, invitations, email types. |
| 030 | Office contacts + appointment contacts (tagged contacts). |

Migrations 006, 012, 026, 029 are **MySQL (cPanel)** DDL, intended for manual execution on the cPanel server — they do not run on Supabase.

---

## 9. `public/`

Static assets served as-is:
- `usls-oas.png`, `usls-oas-white.png`, `OAS ADMIN.png` — logos used in the UI, emails, and PDF tickets.
- `fonts/` — the Gotham font family (woff2) used by the app.
- Default Next.js placeholders (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`).

---

## 10. Build / config files

| File | Purpose |
|---|---|
| `next.config.ts` | Next.js options (currently default/minimal). |
| `tsconfig.json` | TypeScript project settings + path alias (`@/*` → `src/*`). |
| `eslint.config.mjs` | ESLint Flat Config (Next + TS rules). |
| `postcss.config.mjs` | Tailwind v4 PostCSS wiring. |
| `.env.example` | Documented environment variables (see Deployment Instructions). |
| `AGENTS.md` | Agent/Copilot instructions for the Next.js version used. |

---

## 11. Where do key behaviors live?

| "I want to change…" | Look in |
|---|---|
| Booking form rules | `src/app/api/appointments/route.ts` + `src/components/forms/*` |
| Gate scanning window | `src/lib/time.ts` (`getEntryTimingStatus`) |
| Email templates | `src/lib/email.ts` |
| Calendar event | `src/lib/calendar.ts` |
| Reference format | `src/lib/reference.ts` |
| Dashboard actions (approve/decline/postpone/reset) | `src/lib/appointment-actions.ts` + `src/app/admin/page.tsx` |
| PDF ticket | `src/lib/ticket.ts` |
| Sidebar / role access | `src/app/admin/layout.tsx` |
| Schema | `supabase/migrations/` + `src/types/database.ts` |
| Audit display | `src/lib/audit.ts` + `src/app/admin/audit/page.tsx` |