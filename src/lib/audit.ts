import type { AuditAction, AuditLog } from "@/types/database";

const ACTION_LABELS: Record<AuditAction, string> = {
  approve: "Approved appointment",
  decline: "Declined appointment",
  postpone: "Postponed appointment",
  entry: "Checked in visitor",
  checkout: "Checked out visitor",
  entry_denied: "Denied entry",
  create_account: "Created admin account",
  delete_account: "Removed admin account",
  create_office: "Created office",
  update_office: "Updated office",
  delete_office: "Deactivated office",
  block_time: "Blocked appointment time",
  unblock_time: "Unblocked appointment time",
  reset_qr: "Reset visitor reference",
  archive_sync: "Synchronized archive",
  login: "Signed in",
  create_invitation: "Created invitation",
  create_contact: "Created office contact",
  update_contact: "Updated office contact",
  delete_contact: "Removed office contact",
};

export function getAuditActionLabel(action: string): string {
  return ACTION_LABELS[action as AuditAction] || action.replace(/_/g, " ");
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
    case "delete_account":
      return [log.target_email, role].filter(Boolean).join(" - ") || "Admin account changed";
    case "create_office":
    case "update_office":
    case "delete_office":
      return office || "Office settings changed";
    case "block_time":
    case "unblock_time":
      return [date, timeSlot, reason].filter(Boolean).join(" - ") || "Appointment time changed";
    case "create_contact":
    case "update_contact":
    case "delete_contact": {
      const contact = value(details, "contact_name");
      return [contact, log.target_email, office].filter(Boolean).join(" - ") || "Office contact changed";
    }
    case "login":
      return role ? `Role: ${role}` : "Admin session started";
    default:
      return log.appointment_id ? `Appointment ${log.appointment_id.slice(0, 8)}` : "System activity";
  }
}