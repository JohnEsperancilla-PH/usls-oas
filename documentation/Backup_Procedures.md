# USLS OASYS — Backup Procedures (Power Outage Manual Operation)

> **Purpose:** This document defines what the gate team and admins do when an unplanned **power outage** (blackout/brownout) takes the gate scanning stations offline, and how records are reconciled once power is restored.
>
> **Scope:** These procedures apply **only during a power outage** that prevents electronic gate verification. When the system is online, the normal gate scanning process in the User's Manual must be followed.

---

## 1. Why this is needed

The gate entry system verifies a visitor's appointment using the online reference number. If the gate station loses power (or internet), it cannot scan references. To keep campus entry working, the gate falls back to **manual recording**:

- Visitors still need a valid appointment and a reference number.
- The gate officer **writes down** the reference number and visitor details on a paper gate log.
- No electronic scan is performed until power returns.

---

## 2. Roles and responsibilities

| Role | Responsibility during outage |
|---|---|
| **Gate officer / security** | Manual recording of arriving visitors; physical verification of valid ID; boots of the paper log. |
| **Office admin / super admin** | Post-recovery reconciliation and approve-override of manually recorded entries. |
| **Super admin** | Owns the gate log files at the end of each day; final verification of the manual record. |

---

## 3. Outage gate log — how to record manually

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

### 3.3 During the outage — steps for the gate officer

1. Ask for the visitor's **reference number** (and ticket if available).
2. **Confirm the reference number aloud** and make sure the visitor agrees it is theirs.
3. Copy the reference number exactly into the log.
4. Verify the visitor's **valid ID** and count the group.
5. Record arrival time, name, office, and group size.
6. Apply normal entry rules:
   - Only admit visitors who can produce a reference number.
   - If a visitor has **no reference number** and was never approved, do **not** admit them; refer them to the visiting office.
   - Denial remarks must be recorded in the log.
7. Keep the log inside the gate station; do not leave it unattended.

> **Important:** Do NOT manually mark entries as "approved" or "completed" in the live system during the outage — the system may be partially offline, and the official reconciliation happens later (Section 4).

---

## 4. When power returns — reconciliation

Once the gate system is back online, the manual entries are reconciled so the live records match what actually happened at the gate.

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

- Keep the **printed outage checklist** and blank gate logs at each gate station at all times (check monthly).
- The gate officer should have **offline copies** (`printed`) of the evacuation/fire and emergency contact lists — the system is not available during an outage.
- Reconcile **on the same day** the outage ends; late reconciliation risks duplicate entries or forgotten visitors.
- Never delete manual log entries; corrections are made with a strikethrough + initials, never white-out.
- If the outage lasts more than one day, start a new log page each day.

---

## 7. Contact escalation

| Issue | Escalate to |
|---|---|
| Reference mismatch / duplicate | Office admin → Super admin |
| System still offline after expected restoration | IT / Vercel / Supabase (see Deployment Instructions) |
| Missing gate log sheets | Super admin (records) |