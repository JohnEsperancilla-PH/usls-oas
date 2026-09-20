# USLS OASYS — API Documentation

The Online Appointment System exposes a REST API under `/api/`. Public endpoints serve the booking form; authenticated endpoints serve the admin dashboard and gate. All responses are JSON except the email-action page (HTML) and the ticket download (PDF).

## 1. Authentication

Most endpoints authenticate by reading the Supabase session cookie and matching it to the `admins` table (`src/lib/rbac.ts`):

| Guard | Rules |
|---|---|
| `getAuthAdmin` | Returns 401 if not signed in, 403 if the user is not in `admins`. |
| `requireSuperAdmin` | 403 unless the admin role is `super_admin`. |
| `requireEntryUser` | 403 unless role is `gate_user` or `super_admin` (gate access). |

Session flow: the client signs in to Supabase Auth (`/admin/login` uses email + password; `/entry` uses employee ID + password). The session cookie is sent automatically on subsequent requests.

---

## 2. Public (no login)

### 2.1 `GET /api/offices`
Public list of active offices for the booking form.

- **Auth:** none
- **Query params:** none
- **Response 200:** array of office rows (`id`, `name`, `email`, `description`, `contact_email`, `contact_phone`, `category`, `operating_hours`, `capacity_per_slot`, `active`, …)
- **Reason for existing:** gives visitors the office catalog grouped by category so they can pick who to visit.

### 2.2 `GET /api/availability`
Slot availability used by the booking form's date and time pickers.

- **Auth:** none
- **Query params:**
  - `officeId` (required)
  - `date=YYYY-MM-DD` (per-slot detail for one day), **or**
  - `month=YYYY-MM` (which dates in the month still have open slots)
- **Response 200 (date mode):** `{ office: {...}, date, slots: [{ time, label, available, remaining, blocked, blockReason, past }] }`
- **Response 200 (month mode):** `{ office: {...}, slots: [...], availability: { "YYYY-MM-DD": { total, available } } }`
- **Notes:** fixed 8:00 AM – 5:00 PM day, 30-minute slots, lunch break 12:00–1:30 PM never bookable, weekends closed, past slots flagged and unavailable, capacity accounts for 60-minute bookings consuming two slots.
- **Reason for existing:** prevents visitors from choosing full, blocked, or past slots before submitting.
- **Errors:** 400 `officeId is required`; 404 `Office not found`; 400 `Provide date or month parameter`.

### 2.3 `POST /api/appointments`
Public, self-service appointment booking (the core workflow).

- **Auth:** none
- **Rate limit:** 5 requests / 15 minutes / IP.
- **Body:**
  - Required: `fullName`, `phone`, `email`, `validId` (whitelisted ID type), `officeId`, `personToMeet`, `date`, `timeSlot`, `duration` (30 or 60), `purposeOfVisit`.
  - Optional: `visitorCategory` (`external | parents | alumni | vendor`), `visitorCount` (1–10), `additionalVisitors` (`[{ fullName, validId }]`, must equal `visitorCount - 1`), `hasVehicle`, `vehicleCount` (0–5), `vehicles` (`[{ plateNumber, makeModel? }]`).
- **Response 201:** `{ message, appointment: { id, status: "pending" } }`
- **Business rules (409):** blocked time slot, or slot at full capacity.
- **Side effects (post-response):** booking confirmation email to the visitor; admin alert emails (with one-click Approve/Deny links) to the office admins and super admins; `email_logs` rows; cPanel MySQL archive mirror.
- **Reason for existing:** the main way visitors request a campus appointment. Records stay `pending` until an admin approves them.
- **Errors:** 400 for invalid/missing fields; 429 for rate limit; 409 for conflict rules.

---

## 3. Gate (security) — role: `gate_user` or `super_admin`

### 3.1 `POST /api/entry/auth`
Gate-station login. Separate from the admin login.

- **Auth:** none for the request itself (login endpoint)
- **Rate limit:** 10 requests / 15 minutes / IP.
- **Body:** `{ employeeId, password }`
- **Response 200:** `{ authenticated: true, session, officerName }`
- **Response 401:** `{ authenticated: false, message }` (invalid employee ID or password)
- **Reason for existing:** lets gate officers sign in with employee ID + password without admin access.

### 3.2 `GET /api/entry/auth`
Checks whether the current session is a valid gate user.

- **Auth:** `getAuthAdmin` + `requireEntryUser`
- **Response 200:** `{ authenticated: true, officerName }`
- **Response 401/403:** `{ authenticated: false, message }`

### 3.3 `GET /api/scan`
Lists today's expected (approved/completed) visitors for the gate dashboard.

- **Auth:** `getAuthAdmin` + `requireEntryUser`
- **Response 200:** `{ date, visitors: [...] }` — each visitor includes full appointment details, group visitors, and vehicles.
- **Reason for existing:** gives the gate team a "who's coming today" reference list and click-to-autofill.

### 3.4 `POST /api/scan`
Verifies a reference number at the gate and applies an action.

- **Auth:** `getAuthAdmin` + `requireEntryUser`
- **Rate limit:** 30 requests / 60 seconds / IP.
- **Body:** `{ token, action? }` — `action` is `preview` (default) | `allow_entry` | `deny_entry` | `checkout`; plus optional `idVerified` and `reason`.
- **Response shape:** `{ success, reason, message, appointment? }`
- **Reasons:** `preview | not_found | pending | cancelled | expired | wrong_date | already_used | duplicate_scan | invalid_id | checked_out | entry_denied | too_early | too_late | approved`
- **Business rules:**
  - `preview` / `allow_entry`: entry window is 30 minutes before to 15 minutes after the appointment time (`getEntryTimingStatus`).
  - `allow_entry` succeeds only when the reference is currently unused; sets `status = completed`, `scanned_at`, `qr_used_at`.
  - `deny_entry` requires a reason (up to 500 chars), sets `status = entry_denied`.
  - `checkout` records the visitor's departure (`checked_out_at`).
  - Not found → 404; status conflicts/already used → 409; wrong/expired date → 409; false `idVerified` → 409.
- **Side effects:** `entry` / `entry_denied` / `checkout` audit log entries; cPanel mirror update.
- **Reason for existing:** single-use reference verification at the gate with time-window enforcement and ID check.

---

## 4. Admin — appointments

### 4.1 `GET /api/admin/appointments`
List appointments for the dashboard.

- **Auth:** any `admins` user
- **Query params:** `status` — `history` (declined/completed/expired), `all`, or a specific status.
- **Scope:** `office_admin` only sees their own office's appointments.
- **Response 200:** array of appointment rows joined with `offices`, plus nested `visitors[]` and `vehicles[]`.

### 4.2 `POST /api/appointments/approve`
Admin approves a pending appointment, generating the reference number.

- **Auth:** any `admins` user; `office_admin` restricted to own office.
- **Body:** `{ appointmentId }`
- **Business rule:** appointment must be `pending` or `postponed`.
- **Response 200:** `{ message, appointment: { id, status: "approved" } }`
- **Side effects:** approval email (contains the reference number), Google Calendar event for the visitor + office, audit log, cPanel mirror.
- **Reason for existing:** manual review decides which bookings become gate-valid.

### 4.3 `POST /api/appointments/decline`
Declines **or postpones** a pending/postponed appointment (postpone = decline request + reschedule).

- **Auth:** any `admins` user; `office_admin` restricted to own office.
- **Body:** `{ appointmentId, reason?, postpone?: { date, timeSlot } }`
  - With `postpone`: sets status `postponed`, new date/time, sends postponement email, audits `postpone`.
  - Without `postpone`: sets status `declined`, sends decline email, audits `decline`.
- **Response 200:** `{ message, appointment }`
- **Reason for existing:** lets the office decline a booking or move it to another slot.

### 4.4 `POST /api/appointments/reset-qr`
Re-issues a new reference number for a completed appointment (back to `approved`).

- **Auth:** any `admins` user; `office_admin` restricted to own office.
- **Body:** `{ appointmentId }`
- **Business rule:** appointment must be `completed`.
- **Response 200:** `{ message, emailSent, emailPending, appointment }`
- **Side effects:** resend-approval email with the new reference, audit `reset_qr`, cPanel mirror.
- **Reason for existing:** lets a returning visitor re-enter after leaving (new single-use code).

### 4.5 `POST /api/appointments/email-action` (GET and POST both execute)
One-click Approve/Deny executed from the links in admin alert emails — no login needed.

- **Auth:** HMAC-SHA256 signed action token (`QR_SECRET`) instead of a session.
- **Query params:** `action=approve|decline`, `token=...`, `appointmentId=...`
- **Token:** generated by `generateActionToken`, valid 72 hours, encodes `{ appointmentId, action, adminEmail, officeId, iat, exp }`.
- **Response:** an HTML confirmation page (Approve/Deny success, "Already reviewed", "Link expired/invalid").
- **Side effects:** same as approve/decline (email, calendar event on approve, audit, cPanel mirror).
- **Reason for existing:** admins can act on an appointment straight from their inbox, without opening the dashboard.

---

## 5. Admin — offices

### 5.1 `GET /api/admin/offices`
List offices. `office_admin` only sees their own office; `super_admin` sees all.

### 5.2 `POST /api/admin/offices`
**Auth:** `super_admin`. Creates an office. Body: `name` (required), `email`, `description`, `operating_hours`, `capacity_per_slot`, `contact_email`, `contact_phone`, `category`. Audits `create_office`.

### 5.3 `PUT /api/admin/offices`
**Auth:** `super_admin`. Updates an office. Body: `id` (required) plus any fields above. Audits `update_office`.

### 5.4 `DELETE /api/admin/offices?id=...`
**Auth:** `super_admin`. Soft-deactivates an office (`active = false`, not a real delete). Audits `delete_office`.

---

## 6. Admin — accounts (super admin)

### 6.1 `GET /api/admin/accounts`
**Auth:** `super_admin`. Lists all admin accounts (joined with office names).

### 6.2 `POST /api/admin/accounts`
**Auth:** `super_admin`. Creates an account.
- Body: `name`, `role` (`super_admin | office_admin | gate_user`), `password` (8–128), `email` (skipped for `gate_user`), `employee_id` (required for `gate_user`, `/^[A-Za-z0-9-]{3,30}$/`), `office_id` (required for `office_admin`).
- Duplicate `employee_id` → 409.
- Creates a real Supabase Auth user (`email_confirm: true`); gate users get a synthetic email `gate.<id>@auth.usls-oas.local`.
- Response 201: `{ message, userId }`. Audits `create_account`.
- **Reason for existing:** single place to provision admin, office-admin, and gate-user logins.

### 6.3 `DELETE /api/admin/accounts`
**Auth:** `super_admin`. Removes an account.
- Body: `{ id, password }` — re-authenticates the super admin first; cannot delete self.
- Deletes the Supabase Auth user and the `admins` row. Audits `delete_account`.

---

## 7. Admin — blocked times

### 7.1 `GET /api/admin/blocked-times`
**Auth:** any `admins` user. Lists blocked slots. Query: `officeId` (for super admins), `month=YYYY-MM`.

### 7.2 `POST /api/admin/blocked-times`
**Auth:** any `admins` user (`office_admin` scoped to own office). Blocks a slot. Body: `{ office_id, date, time_slot, reason? }`. Duplicate → 409. Audits `block_time`.

### 7.3 `DELETE /api/admin/blocked-times`
**Auth:** any `admins` user. Unblocks a slot. Body: `{ id }` or `{ office_id, date, time_slot }`. Audits `unblock_time`.

---

## 8. Admin — invitations

### 8.1 `GET /api/admin/invitations`
**Auth:** any `admins` user except `gate_user`. Lists manual invitations (appointments with `is_invitation = true`), with email status per row plus vehicles and tagged contacts.

### 8.2 `POST /api/admin/invitations`
**Auth:** any `admins` user except `gate_user` (`office_admin` scoped to own office). Creates a pre-approved invitation:
- Creates the appointment with `status = "approved"` and a reference number immediately (no approval step).
- Body: `fullName`, `officeId`, `email?`, `phone?`, `validId?`, `visitorCategory?`, `personToMeet?`, `purposeOfVisit?`, `date?`, `timeSlot?`, `duration?` (default 30), `vehicles?`, `taggedContactIds?`.
- `taggedContactIds` must belong to valid active contacts of the target office (else 400).
- Response 201: `{ message, invitation: { id, referenceNumber, status: "approved" } }`
- **Side effects:** invitation email with **PDF ticket** attached, plain notification email to tagged office contacts, Google Calendar event (visitor + tagged contacts + office), audit `create_invitation`, cPanel mirror.
- **Reason for existing:** lets offices issue pre-approved entry passes (with PDF ticket) without the normal approval queue.

### 8.3 `GET /api/admin/invitations/[id]/ticket`
**Auth:** any `admins` user except `gate_user` (`office_admin` scoped to own office). Downloads the PDF visitor ticket.
- Response 200: `application/pdf`, filename `USLS-OASYS-Ticket-<ref>.pdf`.
- Errors: 404 unknown invitation, 400 not an invitation, 409 no reference.

---

## 9. Admin — office contacts

### 9.1 `GET /api/admin/office-contacts?officeId=...`
**Auth:** any `admins` user except `gate_user` (`office_admin` always scoped to own office). Lists active contacts.

### 9.2 `POST /api/admin/office-contacts`
**Auth:** any `admins` user except `gate_user`. Body: `officeId` (office_admin forced to own office), `name` (required), `email` (required, valid format), `position?`. Audits `create_contact`. Response 201.

### 9.3 `PUT /api/admin/office-contacts/[id]`
**Auth:** any `admins` user except `gate_user` (`office_admin` scoped to own office). Updates `name` / `email` / `position`. Audits `update_contact`.

### 9.4 `DELETE /api/admin/office-contacts/[id]`
**Auth:** any `admins` user except `gate_user`. Soft-deletes a contact (`active = false`). Audits `delete_contact`.
- **Reason for existing:** contacts get tagged on invitations so they receive the calendar invite and a notification email, without receiving the visitor ticket PDF.

---

## 10. Admin — audit log

### 10.1 `GET /api/admin/audit`
**Auth:** `super_admin`. Returns the latest 100 audit log entries. Read-only.

---

## 11. Admin — settings

### 11.1 `GET /api/admin/settings`
**Auth:** any `admins` user. Returns all `system_settings` as a flat object.

### 11.2 `PUT /api/admin/settings`
**Auth:** `super_admin`. Upserts the settings object (`system_name`, `support_email`, `support_phone`, `max_advance_days`, `min_notice_hours`, and the `notify_*` toggles).

---

## 12. Admin — auth

### 12.1 `POST /api/admin/auth`
Authorizes a dashboard sign-in (records the login).

- **Rate limit:** 10 requests / 60 seconds / IP.
- **Body:** `{ email }`
- **Response 403:** `Not an admin` / `Gate accounts cannot access the admin dashboard`.
- **Response 200:** `{ authorized: true, admin }` (full admin row + nested office).
- **Side effect:** audit log `login`.
- **Note:** password verification happens in Supabase Auth itself; this route confirms the user is a known (non-gate) admin.

---

## 13. System / health

### 13.1 `GET /api/test/email`
Sends a test approval email. **Disabled in production** (404). Body: `{ to }`. For dev/debugging only.

### 13.2 `GET /api/health?token=...`
Cron keep-alive / heartbeat. The token (or `x-cron-secret` header) must equal `CRON_HEALTH_TOKEN`. Inserts an `app_health` row and returns `{ status: "ok", time }`. Used by an external scheduler (e.g. cron-job.org) to keep the serverless instance awake and confirm DB connectivity.

---

## 14. Status / lifecycle reference

Appointment statuses: `pending → approved → completed`, or `pending/postponed → declined | entry_denied | expired`, with `postponed` as a rescheduled pending state.

Email-notification toggles (Settings → Email Notifications): `notify_confirmation`, `notify_admin_alert`, `notify_approval`, `notify_decline`, `notify_postponement`, `notify_invitation`, `notify_qr_resend`.

Audit actions recorded: `login`, `create_account`, `delete_account`, `create_office`, `update_office`, `delete_office`, `block_time`, `unblock_time`, `create_contact`, `update_contact`, `delete_contact`, `create_invitation`, `approve`, `decline`, `postpone`, `reset_qr`, `entry`, `entry_denied`, `checkout`.

Rate limits (per IP, in-memory per server instance): booking 5/15 min, scan 30/60 s, entry login 10/15 min, admin auth 10/60 s.

Security defaults from the edge middleware: HSTS, CSP, frame denial, nosniff, no-store on all `/api/*` responses.