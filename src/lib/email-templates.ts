// Editable email text set by super admins under Settings > Email Notifications.
// Saved text is plain text: it is escaped when rendered, so it can't add HTML to an email.
// The reference number, QR code, action buttons, and appointment values are never editable.

export interface EmailField {
  label: string;
  default: string;
  multiline?: boolean;
  // Extra placeholders on top of EMAIL_PLACEHOLDERS.
  placeholders?: readonly string[];
  noPlaceholders?: boolean;
  hint?: string;
}

export const EMAIL_PLACEHOLDERS = ["name", "office", "date", "time"] as const;

export type EmailPlaceholderValues = Record<(typeof EMAIL_PLACEHOLDERS)[number], string>;

const subject = (text: string): EmailField => ({ label: "Subject", default: `${text} - {name} - {office} - USLS OASYS` });
const heading = (text: string): EmailField => ({ label: "Heading", default: text });
const message = (text: string): EmailField => ({ label: "Message", default: text, multiline: true });
const greeting: EmailField = { label: "Greeting", default: "Dear {name}," };
const detailsTitle = (text = "Appointment Details"): EmailField => ({ label: "Details Table Title", default: text, noPlaceholders: true });
const statusLabel = (text: string): EmailField => ({ label: "Status Text", default: text, noPlaceholders: true });
const contactIntro = (text: string): EmailField => ({ label: "Office Contact Text", default: text, hint: "Shown above the office's email and phone." });
const contactFallback = (text: string): EmailField => ({ label: "No Contact Details Text", default: text, hint: "Shown when the office has no email or phone." });
const gateNotes: EmailField = {
  label: "Gate Instructions",
  default: [
    "Present this ticket or your reference number at **USLS Gate 2** on your appointment date.",
    "Bring the {valid_id} you listed — the Guard will issue your visitor's pass.",
    "{arrival_note}",
    "{entry_rule}",
  ].join("\n"),
  multiline: true,
  placeholders: ["valid_id", "arrival_note", "entry_rule"],
  hint: "One bullet per line. {arrival_note} and {entry_rule} follow the Gate Entry Window. Removing them hides those times from visitors.",
};
const referenceNote: EmailField = { label: "Reference Number Note", default: "This reference number is single-use and will be disabled after entry." };

const APPROVAL_MESSAGE = "Great news! Your appointment has been approved. Please present your reference number below at the gate for entry.";
const QUESTIONS_INTRO = "If you have questions about your appointment, contact the office:";
const QUESTIONS_FALLBACK = "If you have questions, contact the office directly.";

const approvalFields = (subjectText: string) => ({
  subject: subject(subjectText),
  heading: heading("Appointment Approved"),
  greeting,
  message: message(APPROVAL_MESSAGE),
  gate_notes: gateNotes,
  reference_note: referenceNote,
  details_title: detailsTitle(),
  status_label: statusLabel("Approved"),
  contact_intro: contactIntro(QUESTIONS_INTRO),
  contact_fallback: contactFallback(QUESTIONS_FALLBACK),
});

export const EMAIL_TEMPLATES = {
  confirmation: {
    subject: subject("Appointment Confirmation"),
    heading: heading("Appointment Submitted"),
    greeting,
    message: message("Your appointment has been received and is pending review."),
    gate_notes: gateNotes,
    details_title: detailsTitle(),
    status_label: statusLabel("Pending"),
    contact_intro: contactIntro("For follow-up questions, contact the office:"),
    contact_fallback: contactFallback(QUESTIONS_FALLBACK),
  },
  admin_alert: {
    subject: subject("New Appointment Request"),
    heading: heading("New Appointment Request"),
    message: message("A new appointment has been submitted and is waiting for your review."),
    details_title: detailsTitle("Visitor Information"),
    footer_note: { label: "Footer Note", default: "You are receiving this because you are an administrator for this office." } as EmailField,
  },
  approval: approvalFields("Appointment Approved"),
  decline: {
    subject: subject("Appointment Declined"),
    heading: heading("Appointment Declined"),
    greeting,
    message: message("We regret to inform you that your appointment has been declined."),
    reason_text: { label: "Reason Line", default: "Reason: {reason}", placeholders: ["reason"], hint: "Shown when the office gives a reason." } as EmailField,
    no_reason_text: { label: "No Reason Line", default: "A reason was not provided — please contact {office_contact} if you believe this is an error.", placeholders: ["office_contact"], hint: "Shown when the office gives no reason." } as EmailField,
    rebook_text: { label: "Rebooking Line", default: "{booking_link} anytime, or contact {office_contact}.", placeholders: ["booking_link", "office_contact"] } as EmailField,
    booking_link_text: { label: "Booking Link Text", default: "Submit a new appointment", noPlaceholders: true } as EmailField,
    details_title: detailsTitle(),
    status_label: statusLabel("Declined"),
    contact_intro: contactIntro("If you believe this was an error, contact the office:"),
    contact_fallback: contactFallback("If you believe this was an error, please contact the office directly."),
  },
  postponement: {
    subject: subject("Appointment Postponed"),
    heading: heading("Appointment Postponed"),
    greeting,
    message: message("The office has postponed your appointment. Your new schedule is below."),
    schedule_text: { label: "New Schedule Line", default: "New schedule: {date} at {time}", hint: "The office's reason is added after this line when given." } as EmailField,
    reference_note: { label: "Reference Number Note", default: "Your reference number for the new schedule will be sent once the office confirms the appointment." } as EmailField,
    original_title: detailsTitle("Original Schedule"),
    new_title: detailsTitle("New Schedule"),
    status_label: statusLabel("Postponed"),
    contact_intro: contactIntro("If you have questions about the new schedule, contact the office:"),
    contact_fallback: contactFallback("If you have questions about the new schedule, please contact the office directly."),
  },
  invitation: {
    subject: subject("Appointment Invitation"),
    heading: heading("Appointment Invitation"),
    greeting,
    message: message("You have an appointment scheduled with {office}. Please present your reference number below at the gate for entry. Your ticket is attached to this email as a PDF."),
    gate_notes: gateNotes,
    reference_note: referenceNote,
    details_title: detailsTitle(),
    status_label: statusLabel("Confirmed"),
    contact_intro: contactIntro(QUESTIONS_INTRO),
    contact_fallback: contactFallback(QUESTIONS_FALLBACK),
  },
  qr_resend: approvalFields("Appointment Re-approved"),
  // Labels used across every email.
  shared: {
    label_office: { label: "Office Label", default: "Office", noPlaceholders: true } as EmailField,
    label_date: { label: "Date Label", default: "Date", noPlaceholders: true } as EmailField,
    label_time: { label: "Time Label", default: "Time", noPlaceholders: true } as EmailField,
    label_status: { label: "Status Label", default: "Status", noPlaceholders: true } as EmailField,
    label_name: { label: "Name Label", default: "Name", noPlaceholders: true } as EmailField,
    label_valid_id: { label: "Valid ID Label", default: "Valid ID to Present", noPlaceholders: true } as EmailField,
    label_person: { label: "Person to Meet Label", default: "Person to Meet", noPlaceholders: true } as EmailField,
    label_purpose: { label: "Purpose Label", default: "Purpose of Visit", noPlaceholders: true } as EmailField,
    label_visitors: { label: "Number of Visitors Label", default: "Number of Visitors", noPlaceholders: true } as EmailField,
    reference_title: { label: "Reference Number Title", default: "Your Reference Number", noPlaceholders: true } as EmailField,
  },
};

export type EmailTemplateGroup = keyof typeof EMAIL_TEMPLATES;
export type EmailTemplateType = Exclude<EmailTemplateGroup, "shared">;

const fieldsOf = (group: string) => EMAIL_TEMPLATES[group as EmailTemplateGroup] as Record<string, EmailField>;

export function emailTemplateKey(group: string, field: string): `email_${string}` {
  return `email_${group}_${field}`;
}

export function getEmailFields(group: EmailTemplateGroup) {
  return Object.entries(fieldsOf(group)).map(([field, def]) => ({ field, def, key: emailTemplateKey(group, field) }));
}

export const EMAIL_TEMPLATE_GROUPS = Object.keys(EMAIL_TEMPLATES) as EmailTemplateGroup[];

export const EMAIL_TEMPLATE_KEYS = EMAIL_TEMPLATE_GROUPS.flatMap((group) => getEmailFields(group).map(({ key }) => key));

export function getEmailFieldMaxLength(def: EmailField): number {
  return def.multiline ? 2000 : 200;
}

export function getAllowedPlaceholders(def: EmailField): string[] {
  return def.noPlaceholders ? [] : [...EMAIL_PLACEHOLDERS, ...(def.placeholders ?? [])];
}

export function findUnknownPlaceholder(text: string, def: EmailField): string | null {
  const allowed = getAllowedPlaceholders(def);
  const unknown = [...text.matchAll(/\{([^{}]*)\}/g)].find((match) => !allowed.includes(match[1]));
  return unknown ? unknown[0] : null;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type HtmlExtras = Record<string, string>;

// Blank or missing text falls back to the default.
export function renderEmailText<T extends EmailTemplateType>(type: T, saved: Record<string, string>, values: EmailPlaceholderValues) {
  type Field = keyof (typeof EMAIL_TEMPLATES)[T] & string;
  const raw = (group: string, field: string) => saved[emailTemplateKey(group, field)]?.trim() || fieldsOf(group)[field].default;
  const baseValues: Record<string, string> = values;

  // A single pass, so a visitor's name containing "{office}" is never expanded.
  const toHtml = (text: string, extras: HtmlExtras) => escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\{(\w+)\}/g, (match, key: string) => {
      if (key in extras) return extras[key];
      return key in baseValues ? `<strong>${escapeHtml(baseValues[key])}</strong>` : match;
    });

  return {
    // For the subject line and other text that is escaped by whatever displays it.
    plain: (field: Field) => raw(type, field)
      .replace(/\{(\w+)\}/g, (match, key: string) => (key in baseValues ? baseValues[key] : match))
      .replace(/\s+/g, " ")
      .trim(),
    html: (field: Field, extras: HtmlExtras = {}) => toHtml(raw(type, field), extras).replace(/\r?\n/g, "<br/>"),
    lines: (field: Field, extras: HtmlExtras = {}) => raw(type, field).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => toHtml(line, extras)),
    label: (field: keyof typeof EMAIL_TEMPLATES.shared) => raw("shared", field),
  };
}
