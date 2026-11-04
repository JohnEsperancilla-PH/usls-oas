import { createServiceClient } from "@/lib/supabase/server";

// Campus-wide closed dates: one-off dates (holidays) in the closed_dates table, plus weekdays
// closed every week, stored in system_settings. Until migration 047 is applied the table is
// missing; treat that as "nothing closed" so booking keeps working.

const WEEKLY_KEY = "closed_weekdays";
export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DEFAULT_WEEKLY_REASON = "Campus closed";

/** Weekday (1 = Monday … 5 = Friday) → reason, for days closed every week. */
export type ClosedWeekdays = Record<number, string>;

export function parseClosedWeekdays(raw: string | null | undefined): ClosedWeekdays {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: ClosedWeekdays = {};
    for (const [key, reason] of Object.entries(parsed)) {
      const day = Number(key);
      if (day >= 1 && day <= 5 && typeof reason === "string") result[day] = reason.trim() || DEFAULT_WEEKLY_REASON;
    }
    return result;
  } catch {
    return {};
  }
}

export async function getClosedWeekdays(): Promise<ClosedWeekdays> {
  const supabase = createServiceClient();
  const { data } = await supabase.from("system_settings").select("value").eq("key", WEEKLY_KEY).maybeSingle();
  return parseClosedWeekdays(data?.value);
}

export async function saveClosedWeekdays(weekdays: ClosedWeekdays) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("system_settings")
    .upsert({ key: WEEKLY_KEY, value: JSON.stringify(weekdays), updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error("Failed to save weekly closed days");
}

/** Maps each closed date (YYYY-MM-DD) in the range to its reason. A one-off date's reason wins over a weekly one. */
export async function getClosedDatesInRange(startDate: string, endDate: string): Promise<Record<string, string>> {
  const supabase = createServiceClient();
  const [{ data, error }, weekly] = await Promise.all([
    supabase.from("closed_dates").select("date, reason").gte("date", startDate).lte("date", endDate),
    getClosedWeekdays().catch(() => ({} as ClosedWeekdays)),
  ]);
  const closed: Record<string, string> = {};
  if (Object.keys(weekly).length > 0) {
    const cursor = new Date(startDate + "T00:00:00Z");
    const last = new Date(endDate + "T00:00:00Z");
    while (cursor <= last) {
      const reason = weekly[cursor.getUTCDay()];
      if (reason) closed[cursor.toISOString().slice(0, 10)] = reason;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  if (!error) for (const row of data || []) closed[row.date] = row.reason;
  return closed;
}

/** The reason a date is closed, or null if it's open. */
export async function getClosedDateReason(date: string): Promise<string | null> {
  const closed = await getClosedDatesInRange(date, date);
  return closed[date] ?? null;
}

export function closedDateMessage(date: string, reason: string): string {
  const label = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return `The campus is closed on ${label} (${reason}). Please choose another date.`;
}
