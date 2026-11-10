import { createServiceClient } from "@/lib/supabase/server";
import { mirrorAppointmentToCpanel, fromAppointmentRow } from "@/lib/cpanel-mirror";
import { getEntryWindow } from "@/lib/entry-window-server";
import { getEntryTimingStatus, getManilaToday } from "@/lib/time";
import { logAudit } from "@/lib/rbac";

// Approved visits only become "expired" when a late visitor is scanned at the gate, so no-shows would
// otherwise stay "approved" forever. This applies the same rule in bulk: an approved appointment is void
// once it is past the entry window's late limit (or, with no time slot, once its day has passed).
// Run lazily from admin reads, at most once per interval per server instance.

const MIN_INTERVAL_MS = 5 * 60 * 1000;
let lastRun = 0;
let running: Promise<number> | null = null;

export function expireStaleAppointments(): Promise<number> {
  if (running) return running;
  if (Date.now() - lastRun < MIN_INTERVAL_MS) return Promise.resolve(0);
  lastRun = Date.now();
  running = run().catch((err) => {
    console.error("Failed to expire stale appointments:", err);
    return 0;
  }).finally(() => { running = null; });
  return running;
}

async function run(): Promise<number> {
  const supabase = createServiceClient();
  const today = getManilaToday();
  const now = new Date();

  const { data: candidates, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("status", "approved")
    .lte("date", today)
    .is("scanned_at", null)
    .limit(500);
  if (error) throw error;

  const entryWindow = await getEntryWindow();
  const stale = (candidates || []).filter((a) =>
    a.time_slot ? getEntryTimingStatus(a.date, a.time_slot, entryWindow, now) === "too_late" : a.date < today);

  let expiredCount = 0;
  const expiredNames: string[] = [];
  for (const appointment of stale) {
    const expiredAt = new Date().toISOString();
    // Guarded on status so a visitor scanned in the meantime is never overwritten.
    const { data: expired } = await supabase
      .from("appointments")
      .update({ status: "expired", updated_at: expiredAt })
      .eq("id", appointment.id)
      .eq("status", "approved")
      .select("id")
      .maybeSingle();
    if (expired) {
      expiredCount++;
      expiredNames.push(`${appointment.full_name} (${appointment.date}${appointment.time_slot ? ` ${appointment.time_slot}` : ""})`);
      await mirrorAppointmentToCpanel(fromAppointmentRow(appointment, { status: "expired", updated_at: expiredAt }));
    }
  }
  // One entry per run, so no-shows turning "expired" on their own are explained in the audit log.
  if (expiredCount > 0) {
    await logAudit(null, "system", "expire_appointments", {
      meta: { name: "Automatic expiry", count: expiredCount, appointments: expiredNames.slice(0, 50).join("; ") + (expiredNames.length > 50 ? ` and ${expiredNames.length - 50} more` : "") },
    });
  }
  return expiredCount;
}
