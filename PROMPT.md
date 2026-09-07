# USLS OAS — Online Appointment System
### Project Specification & Development Prompt

---

## 1. Project Overview

**USLS OAS** is an online appointment booking system that allows campus visitors (including students) to schedule appointments with specific offices around campus. The system manages the full lifecycle of an appointment: booking → admin approval → reference-number issuance → gate verification.

**Core goals:**
- Let visitors self-book appointments without needing an account.
- Give admins a real-time dashboard to approve/decline appointments.
- Issue secure, single-use reference numbers for verified entry at the gate.
- Keep every appointment mirrored to a cPanel MySQL backup while Supabase remains the live system of record.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend/Backend framework | **Next.js** |
| Hosting | **Vercel** |
| Live database | **Supabase (Postgres)** — system of record |
| Mirror database | **cPanel MySQL** (`appointments` table) — written in parallel on every create/status change |
| Image storage | — *(not used; no ID photo upload)* |
| Email | **Resend** (transactional SMTP) |
| Auth/Sessions | Supabase Auth, httpOnly session cookie |
| Reference numbers | Generated server-side (8 chars, unambiguous alphabet), stored in `qr_token`; HMAC-signed action links for email approve/decline |

---

## 3. System Flow

### 3.1 Visitor Booking Flow (Public, no login required)
**Step 1 — Identity Info**
- Full name
- Phone number
- Email address
- Valid ID to present at the gate (dropdown of preconfigured ID types — no photo upload)

**Step 2 — Appointment Details**
- Select date and time
- Select visit duration: **30 minutes** or **1 hour**
- Select office to visit

**Step 3 — Submission**
- Data is saved to Supabase (status: `pending`) and mirrored to cPanel MySQL in parallel
- Confirmation email sent to the visitor's submitted email
- Notification email sent to admin(s) with **Approve/Decline** one-click action links (HMAC-signed, 72-hour validity)

### 3.2 Admin Approval Flow
- New appointments appear in the **admin dashboard**, queued for review.
- Office admins only see/act on their own office; super admins see all.
- Admin reviews visitor info + valid ID (shown as text), then Approves or Declines.
- **On Approval:**
  - Status updated to `approved` (+ cPanel mirror)
  - Unique, signed reference number generated (stored in `qr_token`)
  - Email sent to visitor with the reference number and USLS Gate 2 entry instructions
- **On Decline:**
  - Status updated to `declined` (+ cPanel mirror)
  - Email sent to visitor with decline notice (+ optional reason)

### 3.3 Gate Verification Flow
- Dedicated **kiosk screen** at `/entry` — a single reference-number input box.
- The reference number is verified against Supabase.
- On valid verification:
  - Reference number is immediately invalidated (single-use, status → `completed`)
  - Displays visitor name, office, time, and the valid ID to present
- Invalid/already-used/expired reference numbers are flagged clearly.

### 3.4 Data Mirroring (Supabase → cPanel)
- Every appointment write (create, approve, decline, gate entry, reset) is mirrored to the cPanel MySQL `appointments` table **in parallel** with the Supabase write.
- Supabase is the source of truth for live data; the cPanel table is a backup/mirror.
- The admin **History** view (declined/completed/expired) reads from Supabase; there is no separate archive job or "Sync Now".

---

## 4. Database Design Notes

### 4.1 Supabase (Live System) — Core Tables (draft)
- `appointments` — id, full_name, phone, email, valid_id, office_id, date, time_slot, duration, status, qr_token, qr_used_at, created_at, archived (bool)
- `offices` — id, name, operating_hours, capacity_per_slot, active
- `admins` — id, name, email, role, office_id (nullable for super-admins)
- `email_logs` — id, appointment_id, type, status, sent_at, error_message
- `sessions` — managed via auth provider

### 4.2 cPanel MySQL (Mirror) — Single `appointments` table mirroring every appointment write (schema in `supabase/migrations/012_cpanel_appointments_schema.sql`).

---

## 5. Security Requirements

- **CAPTCHA** (hCaptcha/Turnstile) on the public booking form to prevent spam/bot submissions — *TBD*.
- **Email/OTP verification** before an appointment is queued, to prevent fake email submissions — *TBD*.
- **Reference numbers** are server-generated with an unambiguous alphabet; lookups are case/character normalized.
- **Atomic single-use validation** — `/api/scan` only marks completed when `status = approved` and `qr_used_at IS NULL`, so simultaneous attempts can't double-use a reference.
- **Approve/Decline email links** are HMAC-signed (72-hour expiry, office-scoped) and perform the action **immediately** on the first click; replays show "already reviewed".
- **Role-based access control** for the dashboard (super-admin vs. office-level admin, enforced server-side in every route).
- **Audit trail** — log who approved/declined/reset each appointment, when, and with what outcome.
- **Data privacy compliance** (RA 10173 / Data Privacy Act): no ID photos are stored; only the selected ID type (text) is kept.

---

## 6. Branding & Color Scheme

- **Primary color:** `#006633` (USLS Green)
- **Secondary color:** White (`#FFFFFF`)
- Primary green to be used for headers, navigation, primary buttons, and key accents (e.g., "Approve," "Submit" actions).
- White as the dominant background color for a clean, high-contrast, professional look.
- Suggested supporting neutrals (to be confirmed during UI design): a light gray for card backgrounds/borders, and a muted red/amber for "Decline"/error and "Pending" states respectively, to keep those distinct from the primary green.
- Full logo, typography, and extended palette assets — *TBD (Section 8 open decisions)*.

---

## 7. Email Notifications (via Nodemailer)

| Trigger | Recipient | Content |
|---|---|---|
| Booking submitted | Visitor | Confirmation of submission, pending review |
| Booking submitted | Admin(s) | New appointment alert with link to dashboard |
| Appointment approved | Visitor | Approval notice + unique QR code |
| Appointment declined | Visitor | Decline notice (+ reason, if provided) |

**Implementation notes:**
- Use a shared `sendMail()` utility with retry logic (2–3 attempts, backoff).
- Emails should not block the booking response — send asynchronously (queue table + cron, or `waitUntil`).
- Log every email attempt to `email_logs` (status: sent/failed).
- Consider `react-email` or MJML for consistent template rendering across email clients.

---

## 8. Open Decisions Needed Before/During Development

- [ ] **Email/SMTP provider** — currently **Resend**
- [ ] **List of offices**, their operating hours, and per-slot capacity (1 visitor at a time, or multiple concurrent?)
- [ ] **Booking window rules** — how far in advance bookings are allowed, same-day cutoff, blackout dates/holidays
- [ ] **Admin roles** — implemented: `super_admin` + per-office `office_admin` with scoped dashboard access
- [ ] **Visitor categories** — general public vs. student (student number required?) vs. faculty/alumni/vendor?
- [ ] **Data retention period** for appointment records / cPanel mirror
- [ ] **Branding assets** — USLS logo, color palette, fonts (or default to a clean generic design)
- [ ] **Domain** to be pointed to the Vercel deployment

---

## 9. Suggested Build Order

1. Project scaffolding (Next.js + Supabase + Vercel setup)
2. Database schema (Supabase live tables)
3. Public booking form (Step 1 + Step 2 + submission)
4. Image upload + compression pipeline
5. Email integration (Nodemailer + confirmation/admin emails)
6. Admin authentication + dashboard (queue, approve/decline)
7. QR code generation + approval email
8. Gate entry kiosk screen (/entry)
9. cPanel parallel mirror writes
10. Security hardening pass (CAPTCHA, OTP, RBAC, audit logs)
11. Testing + deployment

---

## 10. Environment Variables

Create `.env.local` with:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Email (Nodemailer)
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_pass
EMAIL_FROM=USLS OAS <noreply@usls.edu.ph>

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
QR_SECRET=your_secure_random_string_for_signing_qr_codes
```

---

*Document generated as a working project specification for the USLS Online Appointment System (OAS). To be refined as decisions in Section 7 are finalized.*