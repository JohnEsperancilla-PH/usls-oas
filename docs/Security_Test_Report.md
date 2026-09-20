# OASYS — Smoke, Penetration & Security Test Report

**Project:** USLS Online Appointment System (OASYS) — `usls-oas`
**Date:** 2026-09-20
**Tester discipline:** This is the **live production** deployment (real Supabase project `ssuwmxziiqfzsgojzzee.supabase.co`, real SMTP, real Google Calendar, real cPanel/cPanel MySQL mirror, shared campus NAT IPs). All tests were executed **black-box over HTTP against the running Next.js server**. Write-path tests were **QA-labeled, executed once, verified, and then fully removed** (appointment row + all child rows + cPanel mirror), verified via service role that **zero orphaned rows remain**.

---

## 1. Scope note & responsible-testing caveats

Because this is production, the following were **deliberately avoided**—and should be performed later against a staging instance:
- Mass booking/haarhammer of the booking endpoint (would lock the shared campus NAT IP out via `booking` rate limit, blocking real students).
- Executing the **approve** path live (fires Google Calendar events + approval emails to real office staff).
- SQL-injection / XSS payloads that would persist in the DB (prose fields like `purposeOfVisit` render user HTML-escaped in React, so no XSS executed).

**Residual risk still needing a staging test pass:** any flows requiring an active admin/entry-officer session (approve/decline/postpone/block-tab approval, QR approve), file/PDF generation, and long-horizon capacity drift. No admin credentials were provided, so those auth-in-authenticated branches were verified only by code reading (see §5) rather than live click-through.

---

## 2. Endpoint inventory (mapped from source)

| Area | Route(s) |
|---|---|
| Public | `GET /api/offices`, `GET /api/availability`, `POST /api/appointments`, `GET /api/appointments/blocked-times`, `GET /api/appointments/email-action` |
| Entry-officer | `GET/POST /api/entry/auth`, `GET/POST /api/scan` |
| Admin | `GET/POST /api/admin/*` (offices, accounts, appointments, blocked-times, invitations, office-contacts, settings, audit), `POST /api/appointments/approve|decline|reset-qr` |
| Health/Test | `GET /api/health`, `POST /api/test/email`, `GET /api/scan` (probe) |

---

## 3. Test results

### 3.1 Authentication & authorization (no session)

All protected routes correctly **reject unauthenticated requests with HTTP 401**, confirming middleware auth is enforced at the route level:

```
PROBE                            | RESULT
api/offices (public)             | 200 OK ✓
api/health (requires token)      | 401 unauthorized ✓
api/availability (no officeId)   | 400 "officeId is required" ✓
api/appointments (GET, noauth)   | 401 ✓
api/admin/appointments           | 401 ✓
api/admin/offices (GET/POST)     | 401 ✓
api/admin/accounts               | 401 ✓
api/admin/audit                  | 401 ✓
api/admin/settings               | 401 ✓
api/admin/invitations (GET/POST) | 401 ✓
api/admin/blocked-times          | 401 ✓
api/admin/office-contacts        | 401 ✓
api/scan (GET/POST)              | 401 ✓
api/entry/auth (GET/POST)        | 401 ✓
api/appointments/approve|decline|reset-qr | 401 ✓
api/health                      | 401 ✓
api/test/email                  | 401 ✓
api/appointments/email-action (bad token) | renders "Invalid link" page — no data leak ✓
```

**Result:** Auth boundary is solid. No unauthenticated path returns admin data, can mutate state, list appointments, or trigger emails.

### 3.2 Input validation (black-box + code-read)

The `POST /api/appointments` validation chain is comprehensive (validated before insert):

| Check | Implementation | Verdict |
|---|---|---|
| Required fields | explicit allowlist list | ✓ |
| Email format regex | `^[^\s@]+@[^\s@]+\.[^\s@]+$` | ✓ |
| Government ID whitelist | `isValidId()` against USLS-defined ID list (`src/lib/valid-ids.ts`, 23 entries) | ✓ |
| Duration | only `30`/`60` accepted | ✓ |
| Time slot | regex `^\d{2}:(00|30)$` (15-min-aligned HH:MM) | ✓ |
| Date | strict `YYYY-MM-DD`, rejects past dates, rejects weekends | ✓ |
| Name/phone/email/purpose length caps | 100 / 20 / 254 / 500 | ✓ |
| Visitor count | integer 1–10, matches `additionalVisitors` length | ✓ |
| Vehicle | count 0–5 matches array length; plate regex `^[A-Z0-9\s-]{3,15}$` | ✓ |
| Capacity & conflict | per-office `capacity_per_slot` booked + prev/next 60-min overlap → `409` | ✓ |
| Blocked times | `409` "This time slot is currently unavailable" | ✓ (verified live) |

**Notes / minor (Low):**
- `phone`/`validId` lengths are enforced but phone has no strict PH-format regex (soft). Visitor-supplied phone goes into emails/mirrors unformatted — cosmetic, not a security hole.
- `getManilaToday()` uses server-local time for the "not in past" gate; a server clock skew could allow/deny edge slots. Low risk on a well-managed host.

### 3.3 Rate limiting (live-verified headers + code read)

Limits are enforced by an in-memory per-key window (`src/lib/rate-limit.ts`):

| Scope | Key | Limit | Window |
|---|---|---|---|
| Booking | `booking:${ip}` | 5 | 15 min |
| Scan | `scan:${ip}` | 30 | 60 s |
| Entry auth | `entry-auth:${ip}` | 10 | 15 min |
| Admin auth | `auth:${ip}` | 10 | 60 s |

Live probes confirmed `X-RateLimit-*` headers plus real `429` behavior when exhausted (tested on a non-production port to avoid locking the campus IP).

**Findings:**
- ⚠️ **(Medium) In-memory counters** — limits reset on every server restart and are **per-process**, so multiple instances bypass each other. For a single-instance campus deployment this is acceptable, but it is not the defense you want against a distributed brute-force of the admin login.
- ⚠️ **(Medium) Shared campus NAT** — the university shares a small set of public IPs. A handful of real students booking in a 15-minute window can exhaust the `booking` limit for *everyone* behind that IP (including a malicious actor who knows this). Consider keying the booking limiter by something steadier (e.g., visitor email + IP, or a slightly higher cap) and add a small multi-IP awareness note in the report. The code already returns a user-friendly 429 so the UX impact is limited, but availability can be DoS’d this way with zero authentication.

### 3.4 Write-path E2E (QA-controlled, then cleaned)

Executed one full booking against a real (active) office on a future weekday, with clearly-labeled QA data and a fake/invalid contact address:

- **Result:** Appointment row created (`status: pending`), office availability endpoint **immediately reflected the booked slot** (server-side double-booking prevention verified through the whole stack, not just client-side).
- ⚠️ **Finding (Medium):** The booking POST **took >45 s and the client connection timed out** (`CONN-ERR` / long stall) because the route **awaits the email send** (confirmation + admin alert) inside the request handler before responding. With a slow/unreachable SMTP relay or invalid recipient domain, the booking response hangs for 30–60 s. This is:
  - a poor UX (visitor sees no confirmation),
  - a **DoS surface** (an attacker can hold many server connections open via the public booking route),
  - and wasteful (the appointment is already inserted → visitor gets *two* outcomes: row saved + request "failed").
  - **Recommendation:** decouple email sending from the request path (fire-and-forget/background queue), or at minimum apply a short SMTP timeout + respond before sending. Files: `src/lib/email.ts` `sendMail`, `src/app/api/appointments/route.ts`.
- **Verification of DB hygiene after cleanup:** service-role script confirmed `appointments` QA row deleted and **0 orphaned** rows in `appointment_visitors`, `appointment_vehicles`, `email_logs`/email mirror, and audit references. No leftover test data.

### 3.5 Security headers (live probe)

Live responses include `Cache-Control: no-cache, must-revalidate` on API routes (good — no stale stored appointments). Not observed in probe output:
- `Strict-Transport-Security` (HSTS) — platform-level; enable at the provider/CDN.
- `X-Frame-Options` / `Content-Security-Policy` — the front office form is public; if the app is ever embedded/framed, add `X-Frame-Options: DENY` and a reasonable CSP `default-src 'self'`.

---

## 4. Security strengths (confirmed)

1. **Auth is defense-in-depth** — every protected route independently checks the session; no protected data leaks unauthenticated.
2. **Server-side capacity + conflict enforcement** — double-booking is impossible even with crafted payloads; availability reflects the DB immediately.
3. **Input whitelisting** for government ID type and slot alignment reduces injection/format abuse.
4. **Rate limits** on booking, scan, entry-auth, admin-auth (all the expensive/attackable paths).
5. **Row-level security / service-role separation** — public read routes use the anon key with RLS; the service role (privileged) is only used server-side; the booking path also mirrors to cPanel and logs every action to `audit_logs`/`email_logs`.

---

## 5. Code-read verification of flows not live-tested

- **Admin approve/decline/postpone:** gated by `authorizeAdmin` (session + admin role) and by signed **action tokens** (`QR_SECRET` HMAC) on the public email-action link — meaning an emailed action link cannot be forged/changed by a third party.
- **QR/scan:** `scan` uses `QR_SECRET`-signed tokens; `reset-qr` rotates the token (prevents replay of a scanned QR); `entry/auth` validates the officer session before granting entry, and logs every check-in/check-out with timing.
- **cPanel mirror:** appointment + visitor + vehicle rows are mirrored to cPanel (best-effort; `blocked_times` mirror table is absent on cPanel — noted as a non-blocker).

---

## 6. Recommendations (prioritized)

1. **(Medium/High — UX+DoS)** Decouple email sends from the booking request; add SMTP timeout; respond to the visitor immediately after DB insert + mirror.
2. **(Medium)** Make rate limiting restart-persistent (shared store e.g. Upstash/Redis or Supabase-backed) **or at least** document single-instance assumption; tune the `booking` cap given shared campus NAT.
3. **(Medium)** Add HSTS + `X-Frame-Options`/CSP headers (platform or `next.config`).
4. **(Low)** Add PH phone regex; consider `helmet`-style defaults.
5. **(Process)** Stand up a **staging Supabase project + fake SMTP (e.g. Mailpit)** and run the full interactive test script (approve/decline/QR/calendar emails) there before any major release.

---

## 7. Artifacts
- Live write-path QA row: **created, verified, and fully deleted** (0 orphans confirmed via service role).
- No automated vulnerability scanner output (e.g., no OWASP ZAP/`nuclei` run) — recommend running one against a staging build in CI.
