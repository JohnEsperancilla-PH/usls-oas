# USLS OASYS — User's Manual

This manual is written for the three groups who use the system. Pick the section for you:

- **Part 1 — Visitors (end users):** how to book an appointment and use your reference at the gate.
- **Part 2 — Office Admins:** the admin dashboard, approving/declining/postponing, blocking time, invitations, and contacts.
- **Part 3 — Gate Security:** the gate station, verifying references, allowing/denying entry, and checkout.
- **Part 4 — Super Admin:** features that only the top-level admin can do.

---

# Part 1 — Visitors (end users)

## 1.1 Booking an appointment

1. Open the system at **https://oasys.usls.edu.ph**.
2. Read the welcome popup, then click **Book an Appointment**.

**Step 1 — Your details**
- Enter your full name, phone, and email.
- Choose your **visitor category** (External, Parents, Alumni, Vendor).
- Choose the **valid ID** you will present at the gate (e.g. School ID, Passport, Driver's License).
- If you are coming with a group (up to 10 people), set the number of visitors and add each person's name and ID.
- If you are bringing a vehicle (up to 5), add the plate numbers.
- Tick the consent checkbox, then continue.

**Step 2 — Appointment details**
- Search or pick the **office** you are visiting (they are grouped by department).
- Enter the **person to meet** and the **purpose of your visit**.
- Choose a **date** (open days are marked; weekend and past dates are not offered).
- Choose a **time slot** (slots that are full, blocked, or past are marked unavailable).
- Choose a **duration** (30 or 60 minutes).
- Review the summary, then submit.

## 1.2 What happens next

- You immediately get a **confirmation email**: your appointment is now **pending review**.
- The office reviews your booking. You will receive one of:
  - **Approval email** — contains your **reference number** (8 characters, e.g. `MT7K4PR2`). You will need this at the gate.
  - **Decline email** — explains why; you can book another slot.
  - **Postponement email** — your appointment was moved to a new date/time.

> ⚠️ Keep your approval email. Your reference number is your gate pass and works on the day and time of your visit only.

## 1.3 Arriving at the gate

- Arrive **20–30 minutes early**.
- Entry is allowed from **30 minutes before** your slot until **15 minutes after**.
- Present your **reference number** (email or PDF ticket) and your **valid ID**.

## 1.4 Appointment statuses you may see

| Status | Meaning |
|---|---|
| Pending | The office has not reviewed it yet. |
| Approved | Confirmed — you can enter at the gate. |
| Postponed | Rescheduled to a new date/time. |
| Declined | The office did not accept the booking. |
| Completed | You have entered (checked in). |
| Expired | The entry window passed without use. |

## 1.5 Questions?

Contact the office you booked, or use the support email/phone shown at the bottom of your booking emails.

---

# Part 2 — Office Admins

## 2.1 Logging in

1. Go to **https://oasys.usls.edu.ph/admin/login**.
2. Enter the email and password given to you by the system administrator.
3. You will land on the **Appointments** dashboard.

## 2.2 The dashboard

- Sidebar (left): **Appointments**, **Invitations**, and **Contacts** (your office only).
- The appointment list shows name, office, date/time, status, and email status.
- Use the **filter** tabs to see all, pending, approved, postponed, declined, or history.
- Use the calendar/list toggle to browse by day (calendar mode) or as a list.

## 2.3 Reviewing an appointment

Open an appointment's **Details**. You can:

- **Approve** — confirms the booking and issues the reference number. The visitor gets the approval email; a calendar event is created.
- **Decline** — with an optional reason. The visitor gets a decline email with a rebooking link.
- **Postpone** — pick a new date and time. The visitor gets a postponement email.
- **Re-issue reference** — only for already-**completed** appointments; gives the visitor a fresh reference (e.g. they came back).

> You can act from email too: admin-alert emails contain **Approve / Deny** buttons that work for 72 hours without logging in.

## 2.4 Blocking time slots

In calendar mode, open a day and click a slot to **block/unblock** it (with a reason). Blocked slots stop showing as available to visitors.

## 2.5 Creating invitations (pre-approved passes)

1. Go to **Invitations** → **New Invitation**.
2. Fill in the visitor details, office, date/time, and duration.
3. Optionally add **visitors** (group), **vehicles**, and **tagged office contacts**.
4. Submit. The appointment is immediately **approved** with a reference number.
5. The visitor gets an **invitation email with a PDF ticket**; tagged contacts get a calendar invite and notification.

Invitations skip the approval queue — use them for expected visitors the office has already cleared.

## 2.6 Managing office contacts

- Go to **Contacts**.
- Use **Add Contact** to add a name, email, and position.
- Contact list rows have **Edit** and **Remove**.
- These contacts can be tagged on future invitations so they receive the calendar invite and notification email.

## 2.7 A note on your limits

Office admins see and manage **only your own office** — you cannot approve, decline, or edit appointments, invitations, contacts, blocked times, or setup for other offices.

---

# Part 3 — Gate Security

## 3.1 Logging in at the gate station

1. Open **https://oasys.usls.edu.ph/entry** on the gate computer.
2. Enter your **Employee ID** and **password**, then sign in.

> Your username is your employee ID — you do not need an email address.

## 3.2 The gate homepage

- **Today's expected visitors** — a list of approved visitors for today. Click a name to auto-fill their reference.
- **Gate Entry** box — type/paste a reference number and press **Verify Reference Number**.

## 3.3 Verifying a visitor

1. Ask the visitor for their **reference number** (from their approval email or ticket).
2. Enter it and click **Verify Reference Number**.
3. A preview shows the visitor's details, office, time, and expected ID.

**Then:**
- **Allow Entry** — records entry (visitor is now "Completed/Checked in").
- **Deny Entry** — requires a reason, then records the denial.
- For completed visitors: **Record Visitor Checkout** records when they leave.

## 3.4 Common results

| Result | What to do |
|---|---|
| "Entry window" message (too early/too late) | Wait until the window opens, or reject if past the deadline. |
| "Already used" | This reference was already scanned. Do not allow reuse. |
| "Wrong date / expired" | Check the date; expired appointments can no longer be used. |
| "Pending" | Not yet approved — the visitor must be approved first. |
| "Reference not found" | Type it again; if still not found, contact the office. |
| "Entry denied" | Do not admit; the appointment was denied. |

## 3.5 During a power outage

If the gate computer loses power, follow the **manual backup procedure** in `Backup_Procedures.md`:
- Record each visitor's reference number, name, time, ID, and office on the **paper gate log**.
- Admit based on the written reference.
- When power returns, admins reconcile the log against the system.

## 3.6 Signing out

Use **Sign Out** at the end of your shift.

---

# Part 4 — Super Admin

Super admins can do everything an office admin can (for any office), plus:

## 4.1 Offices
Create, edit, or deactivate offices. Deactivated offices disappear from booking.
Manage each office's **Contacts** via the **Contacts** button on an office.

## 4.2 Accounts
Create admin, office admin, and gate user accounts. To remove an account, confirm with your own password. You cannot delete your own account.

## 4.3 Audit Log
Review every tracked action (logins, approvals, denials, entries, account/office/contact changes, blocks). Read-only, latest 100 entries.

## 4.4 Settings
- System name, support email/phone.
- Booking rules (max advance days, minimum notice hours).
- Email notification toggles (confirmation, admin alert, approval, decline, postponement, invitation, reference re-send).

## 4.5 Power-restore reconciliation
After a gate outage, super admins perform the **approve-override** reconciliation described in `Backup_Procedures.md`: match the manual log to appointments, override pending entries, and sign the log.

---

# Part 5 — Quick reference

| Task | Where | Who |
|---|---|---|
| Book an appointment | `/` (homepage) | Visitor |
| Admin dashboard | `/admin/login` | Office admin / Super admin |
| Gate station | `/entry` | Gate user |
| New invitation | Admin → Invitations → New Invitation | Office admin / Super admin |
| Block a slot | Admin → calendar view → block slot | Office admin / Super admin |
| Manage contacts | Admin → Contacts (or Office → Contacts) | Office admin / Super admin |
| Offices / Accounts / Audit / Settings | Sidebar | Super admin only |
| Ticket PDF download | Invitations list → Ticket PDF | Office admin / Super admin |