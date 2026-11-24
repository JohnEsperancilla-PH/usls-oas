import { isValidId } from "@/lib/valid-ids";
import { MAX_VISITORS } from "@/lib/visitors";
import type { Appointment, AppointmentVisitor } from "@/types/database";

export interface InvitationVisitorInput {
  fullName: string;
  validId: string;
}

type ParseResult = { ok: true; visitors: InvitationVisitorInput[] } | { ok: false; message: string };

/** Additional visitors on an invitation: each needs a name and a valid government-issued ID. */
export function parseAdditionalInvitationVisitors(raw: unknown, expectedCount: number): ParseResult {
  const list = raw === undefined || raw === null ? [] : raw;
  if (!Array.isArray(list)) return { ok: false, message: "Visitor details are invalid" };
  if (list.length > MAX_VISITORS - 1) return { ok: false, message: `Maximum of ${MAX_VISITORS} visitors allowed` };
  if (list.length !== expectedCount) return { ok: false, message: "Visitor count and visitor details don't match" };

  const visitors: InvitationVisitorInput[] = [];
  for (const entry of list) {
    const { fullName, validId } = (entry && typeof entry === "object" ? entry : {}) as { fullName?: unknown; validId?: unknown };
    const name = typeof fullName === "string" ? fullName.trim() : "";
    if (!name) return { ok: false, message: "Each additional visitor must have a name" };
    if (name.length > 100) return { ok: false, message: "Visitor name is too long (max 100 characters)" };
    if (typeof validId !== "string" || !isValidId(validId)) return { ok: false, message: "Each additional visitor must have a valid government-issued ID" };
    visitors.push({ fullName: name, validId });
  }
  return { ok: true, visitors };
}

/** Rows for appointment_visitors: the main visitor first (the booker), then the additional visitors. */
export function buildInvitationVisitorRows(appointmentId: string, booker: InvitationVisitorInput, additional: InvitationVisitorInput[]) {
  return [booker, ...additional].map((visitor, index) => ({
    appointment_id: appointmentId,
    visitor_number: index + 1,
    full_name: visitor.fullName,
    valid_id: visitor.validId,
    is_booker: index === 0,
  }));
}

/**
 * The invitation's visitors as stored. The main visitor always comes from the appointment itself,
 * which also covers older invitations that were saved without appointment_visitors rows.
 */
export function currentInvitationVisitors(appointment: Pick<Appointment, "full_name" | "valid_id">, rows: AppointmentVisitor[]): InvitationVisitorInput[] {
  const additional = rows
    .filter((row) => row.visitor_number > 1)
    .sort((a, b) => a.visitor_number - b.visitor_number)
    .map((row) => ({ fullName: row.full_name, validId: row.valid_id }));
  return [{ fullName: appointment.full_name, validId: appointment.valid_id || "" }, ...additional];
}

/** Names can change until the invitation is used at the gate (or denied, expired or cancelled). */
export function canEditInvitationVisitors(appointment: Pick<Appointment, "status" | "qr_used_at">): boolean {
  return (appointment.status === "approved" || appointment.status === "postponed") && !appointment.qr_used_at;
}
