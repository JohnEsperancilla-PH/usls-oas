import type { AuditAction, AuditLog } from "@/types/database";

const ACTION_LABELS: Record<AuditAction, string> = {
  approve: "Approved appointment",
  decline: "Declined appointment",
  postpone: "Postponed appointment",
  entry: "Checked in visitor",
  checkout: "Checked out visitor",
  entry_denied: "Denied entry",
  create_account: "Created admin account",
  update_account: "Updated admin account",
  delete_account: "Removed admin account",
  reset_password: "Reset admin password",
  approve_account: "Approved admin account",
  reject_account: "Rejected admin account",
  create_office: "Created office",
  update_office: "Updated office",
  delete_office: "Deactivated office",
  permanently_delete_office: "Permanently deleted office",
  block_time: "Blocked appointment time",
  unblock_time: "Unblocked appointment time",
  reset_qr: "Reset visitor reference",
  archive_sync: "Synchronized archive",
  login: "Signed in",
  create_invitation: "Created invitation",
  create_contact: "Created office contact",
  update_contact: "Updated office contact",
  delete_contact: "Removed office contact",
  enable_maintenance: "Enabled maintenance mode",
  disable_maintenance: "Disabled maintenance mode",
  update_maintenance: "Updated maintenance settings",
  update_system_alert: "Updated system update popup",
  update_email_templates: "Updated email text",
  tag_sub_office: "Tagged sub-offices",
  close_date: "Closed campus date",
  reopen_date: "Reopened campus date",
};

export const AUDIT_ACTION_OPTIONS = (Object.entries(ACTION_LABELS) as [AuditAction, string][])
  .map(([value, label]) => ({ value, label }))
  .sort((a, b) => a.label.localeCompare(b.label));

export function getAuditActionLabel(action: string): string {
  return ACTION_LABELS[action as AuditAction] || action.replace(/_/g, " ");
}

/** Field → its value before and after an update. Stored as `changes` in an audit entry's details. */
export type AuditChanges = Record<string, { before: unknown; after: unknown }>;

function sameValue(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => (v === undefined || v === "" ? null : v);
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

/** The fields of `after` whose value differs from `before`, for an audit entry. */
export function diffChanges(before: object | null | undefined, after: object, keys?: string[]): AuditChanges {
  const prev = (before || {}) as Record<string, unknown>;
  const next = after as Record<string, unknown>;
  const changes: AuditChanges = {};
  for (const key of keys || Object.keys(next)) {
    if (!sameValue(prev[key], next[key])) changes[key] = { before: prev[key] ?? null, after: next[key] ?? null };
  }
  return changes;
}

/** Before/after changes for an entry, including older entries that recorded them in their own fields. */
export function getAuditChanges(log: AuditLog): AuditChanges | null {
  const details = log.details || {};
  const stored = details.changes;
  if (stored && typeof stored === "object" && !Array.isArray(stored) && Object.keys(stored).length > 0) return stored as AuditChanges;
  if (log.action === "postpone" && ("original_date" in details || "new_date" in details)) {
    return diffChanges(
      { date: details.original_date, time_slot: details.original_time },
      { date: details.new_date, time_slot: details.new_time },
    );
  }
  if (log.action === "update_account" && details.previous_role !== undefined && details.previous_role !== details.role) {
    return { role: { before: details.previous_role, after: details.role } };
  }
  return null;
}

const FIELD_LABELS: Record<string, string> = {
  name: "Name", email: "Email", description: "Description", operating_hours: "Operating hours",
  capacity_per_slot: "Capacity per slot", active: "Active", contact_email: "Contact email", contact_phone: "Contact phone",
  category: "Category", hide_time_slots: "Hide time slots", can_invite_for_other_offices: "Invites for other offices",
  allow_sub_offices: "Allows sub-offices", parent_office_id: "Main office", parent_office: "Main office",
  max_advance_days: "Max advance booking (days)", min_notice_hours: "Minimum notice (hours)",
  role: "Role", office: "Office", office_id: "Office", position: "Position", date: "Date", time_slot: "Time",
  alert_enabled: "Popup on", alert_start: "Popup starts", alert_end: "Popup ends", alert_headline: "Popup headline",
  alert_message: "Popup message", alert_audience: "Popup audience", scheduled: "Scheduled", startAt: "Starts",
  endAt: "Ends", headline: "Headline", message: "Message", contactEmail: "Contact email", weekday: "Weekday",
};

export function getAuditFieldLabel(key: string): string {
  return FIELD_LABELS[key] || key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function formatAuditValue(raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return "(empty)";
  if (typeof raw === "boolean" || raw === "true" || raw === "false") return raw === true || raw === "true" ? "On" : "Off";
  if (typeof raw === "object") return JSON.stringify(raw);
  return String(raw);
}

function value(details: AuditLog["details"], key: string): string | null {
  const item = details?.[key];
  return item === undefined || item === null || item === "" ? null : String(item);
}

export function getAuditTarget(log: AuditLog): string {
  const details = log.details;
  return (
    value(details, "visitor_name") ||
    value(details, "name") ||
    log.target_email ||
    (log.appointment_id ? `Appointment ${log.appointment_id.slice(0, 8)}` : "System")
  );
}

export function getAuditSummary(log: AuditLog): string {
  const details = log.details;
  const visitor = value(details, "visitor_name");
  const office = value(details, "office_name") || value(details, "name");
  const date = value(details, "date");
  const timeSlot = value(details, "time_slot");
  const reason = value(details, "reason");
  const role = value(details, "role");
  const emailSent = value(details, "email_sent");

  switch (log.action) {
    case "approve":
      return [visitor, office, date && timeSlot ? `${date} at ${timeSlot}` : null, emailSent === "true" ? "visitor emailed" : null]
        .filter(Boolean)
        .join(" - ") || "Appointment approved";
    case "decline":
      return [visitor, reason ? `Reason: ${reason}` : null].filter(Boolean).join(" - ") || "Appointment declined";
    case "postpone": {
      const newDate = value(details, "new_date");
      const newTime = value(details, "new_time");
      return [visitor, newDate && newTime ? `moved to ${newDate} at ${newTime}` : null, reason ? `Reason: ${reason}` : null]
        .filter(Boolean)
        .join(" - ") || "Appointment postponed";
    }
    case "create_invitation":
      return [visitor, office, date && timeSlot ? `${date} at ${timeSlot}` : null, emailSent === "true" ? "invitation emailed" : "ticket not emailed"]
        .filter(Boolean)
        .join(" - ") || "Invitation created";
    case "entry":
      return [visitor, office, date && timeSlot ? `${date} at ${timeSlot}` : null].filter(Boolean).join(" - ") || "Visitor checked in";
    case "entry_denied":
      return [visitor, reason ? `Reason: ${reason}` : null].filter(Boolean).join(" - ") || "Entry denied";
    case "create_account":
    case "update_account":
    case "delete_account":
    case "reset_password":
    case "approve_account":
    case "reject_account":
      return [log.target_email, role].filter(Boolean).join(" - ") || "Admin account changed";
    case "create_office":
    case "update_office":
    case "delete_office":
      return office || "Office settings changed";
    case "permanently_delete_office": {
      const removed = value(details, "appointments_deleted");
      return [office, removed ? `${removed} appointment${removed === "1" ? "" : "s"} deleted` : null].filter(Boolean).join(" - ") || "Office deleted";
    }
    case "block_time":
    case "unblock_time":
      return [date, timeSlot, reason].filter(Boolean).join(" - ") || "Appointment time changed";
    case "create_contact":
    case "update_contact":
    case "delete_contact": {
      const contact = value(details, "contact_name");
      return [contact, log.target_email, office].filter(Boolean).join(" - ") || "Office contact changed";
    }
    case "update_system_alert":
      return [value(details, "enabled") === "true" ? "On" : "Off", value(details, "headline"), value(details, "audience")].filter(Boolean).join(" - ");
    case "update_email_templates":
      return value(details, "emails") || "Email text changed";
    case "login":
      return role ? `Role: ${role}` : "Admin session started";
    default:
      return log.appointment_id ? `Appointment ${log.appointment_id.slice(0, 8)}` : "System activity";
  }
}