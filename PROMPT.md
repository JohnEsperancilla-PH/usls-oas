# USLS OAS — Online Appointment System
### Project Specification & Development Prompt

---

## 1. Project Overview

**USLS OAS** is an online appointment booking system that allows campus visitors (including students) to schedule appointments with specific offices around campus. The system manages the full lifecycle of an appointment: booking → admin approval → QR code issuance → gate verification/scanning.

**Core goals:**
- Let visitors self-book appointments without needing an account.
- Give admins a real-time dashboard to approve/decline appointments.
- Issue secure, single-use QR codes for verified entry at the gate.
- Maintain a long-term archive of appointment records separate from the live system.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend/Backend framework | **Next.js** |
| Hosting | **Vercel** |
| Live database | **Supabase (Postgres)** |
| Archive database | **cPanel MySQL** (periodic sync from Supabase) |
| Image storage | **Vercel Blob** or S3-compatible (R2/B2) — *TBD* |
| Email | **Nodemailer**, via transactional SMTP provider (Resend/SES/SendGrid — *TBD*) |
| Auth/Sessions | Supabase Auth or Auth.js/Lucia, httpOnly session cookie |
| QR generation/scanning | `qrcode` (generation), `html5-qrcode` (scanning) |
| Image compression | `sharp` (server-side), `browser-image-compression` (client-side) |

---

## 3. System Flow

### 3.1 Visitor Booking Flow (Public, no login required)
**Step 1 — Identity Info**
- Full name
- Phone number
- Email address
- Upload photo of valid government-issued ID (or School ID if student)

**Step 2 — Appointment Details**
- Select date and time
- Select visit duration: **30 minutes** or **1 hour**
- Select office to visit

**Step 3 — Submission**
- Data is saved to Supabase (status: `pending`)
- ID image is compressed and uploaded to object storage
- Confirmation email sent to the visitor's submitted email
- Notification email sent to admin(s) with **Approve/Decline** actions that open the admin dashboard (not one-click actions — see Security section)

### 3.2 Admin Approval Flow
- New appointments appear in the **admin dashboard**, queued for review.
- Dashboard requires authentication — **session persists for 24 hours** ("login once a day"); device/browser session is checked before prompting login again.
- Admin reviews visitor info + ID photo, then Approves or Declines.
- **On Approval:**
  - Status updated to `approved`
  - Unique, signed QR code generated
  - Email sent to visitor with the QR code attached/embedded
- **On Decline:**
  - Status updated to `declined`
  - Email sent to visitor with decline notice (+ optional reason)

### 3.3 Gate Verification Flow
- Dedicated **kiosk/scanner screen** at the gate.
- Scans visitor's QR code via device camera.
- On valid scan:
  - QR code is immediately invalidated (single-use)
  - Displays the visitor's submitted ID photo for guard comparison
  - Option to capture a live photo at the gate for additional verification
- Invalid/already-used/expired QR codes are flagged clearly.

### 3.4 Archiving Flow (Supabase → cPanel)
- Live, in-progress appointments remain in Supabase for speed and real-time updates.
- Completed/terminal-state appointments (`completed`, `expired`, `declined`) are periodically synced to cPanel MySQL for long-term archival.
- **Sync direction:** cPanel-side cron job **pulls** from Supabase's REST API (avoids exposing cPanel MySQL to inbound serverless traffic/connection churn).
- **Sync frequency:** *TBD — recommend nightly batch.*
- **Retention in Supabase after archiving:** *TBD — recommend keep-and-archive (not delete) initially.*

---

## 4. Database Design Notes

### 4.1 Supabase (Live System) — Core Tables (draft)
- `appointments` — id, full_name, phone, email, id_image_url, office_id, date, time_slot, duration, status, qr_token, qr_used_at, created_at, archived (bool)
- `offices` — id, name, operating_hours, capacity_per_slot, active
- `admins` — id, name, email, role, office_id (nullable for super-admins)
- `email_logs` — id, appointment_id, type, status, sent_at, error_message
- `sessions` — managed via auth provider

### 4.2 cPanel MySQL (Archive) — Mirrors relevant fields from `appointments` + related tables, insert-only from the sync job.

*(Full schema to be finalized in next development phase.)*

---

## 5. Security Requirements

- **CAPTCHA** (hCaptcha/Turnstile) on the public booking form to prevent spam/bot submissions.
- **Email/OTP verification** before an appointment is queued, to prevent fake email submissions.
- **Signed QR payloads** (HMAC/JWT) — never encode just a raw appointment ID; verify signature server-side on scan.
- **Atomic QR validation** — use DB transaction/row-level locking to prevent race conditions from simultaneous scans.
- **Approve/Decline email links** open the dashboard for authenticated action — they do **not** perform the action directly via link click (prevents accidental approval via email scanners/previews).
- **File upload validation** — restrict file types, size limits, and dimensions before compression/storage.
- **Role-based access control** for the dashboard (super-admin vs. office-level admin).
- **Audit trail** — log who approved/declined each appointment, when, and from what session.
- **Data privacy compliance** (RA 10173 / Data Privacy Act):
  - Consent checkbox on ID submission
  - Defined retention period for ID images
  - Restricted, logged access to stored ID images

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

- [ ] **Email/SMTP provider** (cPanel SMTP vs. Resend/SES/SendGrid/etc.)
- [ ] **Image storage provider** (Vercel Blob vs. R2/B2/S3)
- [ ] **List of offices**, their operating hours, and per-slot capacity (1 visitor at a time, or multiple concurrent?)
- [ ] **Booking window rules** — how far in advance bookings are allowed, same-day cutoff, blackout dates/holidays
- [ ] **Admin roles** — single super-admin, or per-office admins with scoped dashboard access?
- [ ] **Visitor categories** — general public vs. student (student number required?) vs. faculty/alumni/vendor?
- [ ] **Data retention period** for ID images and appointment records
- [ ] **Archive sync frequency** and whether Supabase records are deleted after archiving
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
8. Gate scanning kiosk screen
9. cPanel archive sync job
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