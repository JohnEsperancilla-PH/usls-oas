import { createServiceClient } from "@/lib/supabase/server";
import type { AuthAdmin } from "@/lib/rbac";
import type { EntryLogEvent } from "@/types/database";

export type EntryMethod = "qr" | "manual" | "list";

export function parseEntryMethod(value: unknown): EntryMethod | null {
  return value === "qr" || value === "manual" || value === "list" ? value : null;
}

interface LoggedAppointment {
  id: string;
  office_id: string;
  full_name: string;
  visitor_category?: string | null;
  visitor_count?: number | null;
  date: string;
  time_slot: string | null;
  scanned_at?: string | null;
  offices?: { name?: string | null } | null;
}

const minutesBetween = (fromMs: number, toMs: number) => Math.round((toMs - fromMs) / 60000);

/** How far back a follow-up event may reach to take over the row it replaces. */
export const ENTRY_LOG_MERGE_WINDOW_MS = 30 * 60 * 1000;

/**
 * Follow-up events that replace the visitor's latest row instead of adding another:
 *  - checkout takes over the "already used" lookup that led to it (looking up a checked-in visitor);
 *  - a denial takes over the automatic check-in it reverses.
 */
const MERGES_INTO: Partial<Record<EntryLogEvent, { event: EntryLogEvent; result?: string }>> = {
  checkout: { event: "rejected", result: "already_used" },
  denied: { event: "entry" },
};

/**
 * Records one gate event. Copies the appointment, guard, and device details so the row stays
 * readable later. Never throws: a logging failure must not block the gate.
 * Checkouts and denials update the row they follow up on (see MERGES_INTO), so one gate visit
 * doesn't show up as two lines.
 */
export async function recordEntryLog(input: {
  request: Request;
  admin: AuthAdmin;
  event: EntryLogEvent;
  result: string;
  message?: string | null;
  method?: EntryMethod | null;
  reference?: string | null;
  appointment?: LoggedAppointment | null;
  vehiclePlates?: string[];
  at?: string;
}) {
  try {
    const { request, admin, appointment } = input;
    const at = input.at ? new Date(input.at).getTime() : Date.now();
    const slotAt = appointment?.time_slot ? new Date(`${appointment.date}T${appointment.time_slot}:00+08:00`).getTime() : null;
    const enteredAt = appointment?.scanned_at ? new Date(appointment.scanned_at).getTime() : null;

    const row = {
      event: input.event,
      result: input.result,
      message: input.message ? input.message.slice(0, 500) : null,
      method: input.method ?? null,
      reference: input.reference ? input.reference.slice(0, 40) : null,
      appointment_id: appointment?.id ?? null,
      office_id: appointment?.office_id ?? null,
      office_name: appointment?.offices?.name ?? null,
      visitor_name: appointment?.full_name ?? null,
      visitor_category: appointment?.visitor_category ?? null,
      visitor_count: appointment ? appointment.visitor_count || 1 : null,
      vehicle_plates: input.vehiclePlates?.length ? input.vehiclePlates.join(", ") : null,
      appointment_date: appointment?.date ?? null,
      time_slot: appointment?.time_slot ?? null,
      // Only meaningful for scans on the visit day; other days would give huge, misleading numbers.
      minutes_from_slot: slotAt !== null && Math.abs(at - slotAt) < 24 * 60 * 60 * 1000 ? minutesBetween(slotAt, at) : null,
      minutes_on_site: input.event === "checkout" && enteredAt !== null ? minutesBetween(enteredAt, at) : null,
      guard_id: admin.id,
      guard_name: admin.name,
      guard_username: admin.employee_id,
      guard_role: admin.role,
      ip: (request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "").trim().slice(0, 64) || null,
      user_agent: request.headers.get("user-agent")?.slice(0, 300) || null,
    };

    const supabase = createServiceClient();
    const target = MERGES_INTO[input.event];
    if (target && appointment?.id) {
      const { data: latest } = await supabase
        .from("entry_logs")
        .select("id, event, result, created_at")
        .eq("appointment_id", appointment.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const mergeable = latest
        && latest.event === target.event
        && (!target.result || latest.result === target.result)
        && at - new Date(latest.created_at as string).getTime() <= ENTRY_LOG_MERGE_WINDOW_MS;
      if (mergeable) {
        const { error } = await supabase
          .from("entry_logs")
          .update({ ...row, created_at: new Date(at).toISOString() })
          .eq("id", latest.id)
          .eq("event", target.event);
        if (!error) return;
        console.error("Failed to update entry log, adding a new row:", error.message);
      }
    }

    const { error } = await supabase.from("entry_logs").insert(row);
    // Missing table (migration 050 not applied) or similar: note it, keep the gate working.
    if (error) console.error("Failed to record entry log:", error.message);
  } catch (err) {
    console.error("Failed to record entry log:", err);
  }
}
