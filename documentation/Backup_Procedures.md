# USLS OASYS — Backup Procedures (Power Outage Manual Operation)

> **Purpose:** This document defines the hierarchy of gate verification methods and what to do when systems fail.
>
> **Scope:** These procedures apply to all gate entry operations.
>
> **Note:** The primary scanning interface is now **mobile devices** (smartphones/tablets). The dedicated `/entry` route is deprecated and will be removed in a future release. All gate scanning should be performed via mobile-optimized interfaces.

---

## 1. Verification Method Hierarchy

The gate entry system uses a tiered approach to verify visitor appointments:

### **Primary: QR Code Scanning**
- **Mobile devices** (smartphones/tablets) — main scanning method
- **Desktop/PC stations** — secondary scanning devices
- Make use of Webcams for the Desktop Camera
- Visitors present QR codes from approval emails or tickets
- Gate officers scan using device cameras
- System automatically verifies appointment status and logs entry

### **Secondary: Reference Code Entry**
- If QR scanning fails (camera issues, damaged QR code)
- Gate officer manually enters the reference code into the system
- Available on both mobile and desktop interfaces
- System verifies appointment status same as QR scan
- Use this before resorting to manual logging

### **Tertiary: Manual Paper Logging (Last Resort Only)**
- **Only when:** No internet connection AND no mobile data available
- Visitors still need a valid appointment and reference number
- Gate officer writes down reference number and visitor details on paper gate log
- No electronic verification possible until connectivity returns
- Must be reconciled once systems are back online

---

## 2. Roles and responsibilities

| Role | Responsibility |
|---|---|
| **Gate officer / security** | Primary: QR scanning via mobile devices. Secondary: Reference code entry. Last resort: Manual paper logging when no connectivity. Physical verification of valid ID. |
| **Office admin / super admin** | Post-recovery reconciliation of manually logged entries (only when manual logging was used). |
| **Super admin** | Owns the gate log files at the end of each day; final verification of manual records. |

---

## 3. Manual Paper Logging — Last Resort Only

> **⚠️ IMPORTANT:** Manual paper logging is ONLY used when there is **no internet connection and no mobile data**. Always try QR scanning first, then reference code entry. Only use manual logging as a last resort.

Use the standard **GATE MANUAL LOG** form (paper/sheet) kept at every gate station. Create one entry per arriving visitor group.

### 3.1 Required columns (minimum)

1. **Date** — the date the visitor arrives.
2. **Time of arrival** — actual time of arrival at the gate.
3. **Reference number** — the visitor's reference code (from their approval email or ticket). Copy it exactly, letter-for-letter.
4. **Visitor full name** (booker).
5. **Total number of visitors arriving together** (group).
6. **Office / department being visited** (from the visitor or their email).
7. **Valid ID presented** (e.g., School ID, Driver's License, Passport).
8. **Gate officer name + signature**.
9. **Remarks** (denied, small group, etc.).

### 3.2 Example row

| Date | Time | Reference | Name | # Visitors | Office | Valid ID | Officer |
|------|------|-----------|------|-----------|--------|----------|---------|
| 2026-09-20 | 09:05 | MT7K4PR2 | Juan dela Cruz | 2 | Registrar | Driver's License | R. Tan |

### 3.3 When to use manual logging

**Use manual logging ONLY when:**
- No internet connection available
- No mobile data available
- Both QR scanning and reference code entry are impossible

**Steps for manual logging:**
1. Ask for the visitor's **reference number** (and ticket if available).
2. **Confirm the reference number aloud** and make sure the visitor agrees it is theirs.
3. Copy the reference number exactly into the log.
4. Verify the visitor's **valid ID** and count the group.
5. Record arrival time, name, office, and group size.
6. Apply normal entry rules:
   - Only admit visitors who can produce a reference number.
   - If a visitor has **no reference number** and was never approved, do **not** admit them; refer them to the visiting office.
   - Denial remarks must be recorded in the log.
7. Keep the log inside the gate station; do not leave it unattended. Ensure mobile scanning devices are charged and secured.

> **Important:** Do NOT manually mark entries as "approved" or "completed" in the live system during the outage — the system may be partially offline, and the official reconciliation happens later (Section 4).

---

## 4. When connectivity returns — reconciliation of manual logs

Once internet/mobile data is restored, any manually logged entries must be reconciled so the live records match what actually happened at the gate.

> **Note:** QR scans and reference code entries are automatically logged in the system. Only manual paper logs require reconciliation.

### 4.1 Step 1 — Upload is not automatic

Manual entries do **not** automatically appear in the system. They must be processed by an admin with access to Records/Super Admin role.

### 4.2 Step 2 — Verify each manual reference

1. Log in to the **Admin Dashboard** (`/admin`).
2. Open the **Appointments** list (use dates matching the outage day).
3. For each manually logged reference number, find the corresponding appointment:
   - **Reference number** should match the `Reference` column in the gate log.
   - Confirm the visitor's name, office, and date line up.
4. If the appointment **does not exist** or the reference is missing, investigate with the office admin before approving anything.

### 4.3 Step 3 — Approve-override manually recorded entries

Entries admitted during the outage that were still `pending` (or otherwise not yet `approved`) must be brought to their gate-valid state by the admin:

- Open the appointment → **Approve** (this generates/uses the reference number and sends the approval email).
- For already-approved appointments logged as entered, use **Approve** confirmation that the entry was valid; do not re-issue the reference unless the visitor lost it.
- For completed appointments that were never scanned electronically, the admin may use **Reset QR / re-issue reference** only when the visitor genuinely needs a new code.

> **Only a `super_admin` may approve-override entries** outside their own office scope; `office_admin` may act on their own office's appointments. The Audit Log records every approve/override action for traceability.

### 4.4 Step 4 — Record the reconciliation

- The super admin signs the manual gate log at end of day.
- Any discrepancy (visitor shows up but record says declined/expired; no matching reference) is attached to the Audit Log notes.
- Keep the physical gate log for the standard retention period (as required by the campus records policy).

---

## 5. Who may approve-override

| Entry type | Allowed to override | Notes |
|---|---|---|
| Appointment belongs to `office_admin`'s own office | office admin or super admin | |
| Any appointment | super admin only | Cross-office overrides |
| No matching appointment / unknown reference | super admin + office contacted | Must be investigated before any override |

---

## 6. Best practices and reminders

- **Always try QR scanning first** — this is the primary and fastest method
- **Use reference code entry second** — when QR scanning fails, manually enter the reference code
- **Manual logging is last resort only** — use paper logs ONLY when there is no internet and no mobile data
- Keep the **printed outage checklist** and blank gate logs at each gate station at all times (check monthly)
- Ensure **mobile scanning devices** (smartphones/tablets) are charged, updated, and have offline QR code backup capabilities
- The gate officer should have **offline copies** (`printed`) of the evacuation/fire and emergency contact lists
- Reconcile manual logs **on the same day** connectivity returns; late reconciliation risks duplicate entries or forgotten visitors
- Never delete manual log entries; corrections are made with a strikethrough + initials, never white-out
- If manual logging extends beyond one day, start a new log page each day
- **Mobile-first scanning:** All routine gate scanning should be performed via mobile devices. The `/entry` route is deprecated and will be removed in a future release

---

## 7. Contact escalation

| Issue | Escalate to |
|---|---|
| Reference mismatch / duplicate | Office admin → Super admin |
| QR scanning fails on all devices | Try reference code entry → If that fails, use manual logging → IT support |
| No internet/mobile data for extended period | IT / Vercel / Supabase (see Deployment Instructions) |
| Missing gate log sheets | Super admin (records) |
| Mobile device hardware failure | IT support for device replacement |
| Manual log reconciliation issues | Super admin |