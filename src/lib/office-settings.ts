import { parseHours } from "@/lib/office-hours";

// Office fields an office admin may change for their own office under Office Settings.
// Name, category, active status, and permissions stay with super admins.
export const OFFICE_ADMIN_FIELDS = [
  "email",
  "contact_email",
  "contact_phone",
  "description",
  "operating_hours",
  "capacity_per_slot",
  "hide_time_slots",
  "max_advance_days",
  "min_notice_hours",
] as const;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A blank or null limit means the office follows the system Booking Rules.
function optionalWholeNumber(value: unknown, label: string, min: number, max: number): number | null | { error: string } {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : { error: `${label} must be a whole number from ${min} to ${max}` };
}

// Validates whichever of these fields are present and returns the columns to update.
export function validateOfficeSettings(body: Record<string, unknown>): { updates: Record<string, unknown> } | { error: string } {
  const updates: Record<string, unknown> = {};

  for (const key of ["email", "contact_email"] as const) {
    if (!(key in body)) continue;
    const value = typeof body[key] === "string" ? (body[key] as string).trim() : "";
    if (value && (value.length > 254 || !EMAIL_REGEX.test(value))) {
      return { error: `${key === "email" ? "Office email" : "Contact email"} is not a valid email address` };
    }
    updates[key] = value || null;
  }
  if ("contact_phone" in body) {
    const value = typeof body.contact_phone === "string" ? body.contact_phone.trim() : "";
    if (value.length > 30) return { error: "Contact phone is too long (max 30 characters)" };
    updates.contact_phone = value || null;
  }
  if ("description" in body) {
    const value = typeof body.description === "string" ? body.description.trim() : "";
    if (value.length > 500) return { error: "Description is too long (max 500 characters)" };
    updates.description = value || null;
  }
  if ("operating_hours" in body) {
    const value = typeof body.operating_hours === "string" ? body.operating_hours.trim() : "";
    const hours = parseHours(value);
    if (!hours) return { error: "Pick the opening and closing times" };
    if (hours.end <= hours.start) return { error: "Closing time must be after opening time" };
    updates.operating_hours = value;
  }
  if ("capacity_per_slot" in body) {
    const n = Number(body.capacity_per_slot);
    if (!Number.isInteger(n) || n < 1 || n > 100) return { error: "Capacity per slot must be a whole number from 1 to 100" };
    updates.capacity_per_slot = n;
  }
  if ("hide_time_slots" in body) {
    if (typeof body.hide_time_slots !== "boolean") return { error: "Hide time slots must be on or off" };
    updates.hide_time_slots = body.hide_time_slots;
  }
  if ("max_advance_days" in body) {
    const result = optionalWholeNumber(body.max_advance_days, "Max advance booking", 1, 365);
    if (result !== null && typeof result === "object") return result;
    updates.max_advance_days = result;
  }
  if ("min_notice_hours" in body) {
    const result = optionalWholeNumber(body.min_notice_hours, "Minimum notice", 0, 168);
    if (result !== null && typeof result === "object") return result;
    updates.min_notice_hours = result;
  }

  return { updates };
}
