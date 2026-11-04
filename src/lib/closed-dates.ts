import { createServiceClient } from "@/lib/supabase/server";

// Campus-wide closed dates (holidays). Until migration 047 is applied the table is missing;
// treat that as "nothing closed" so booking keeps working.

/** Maps each closed date (YYYY-MM-DD) in the range to its reason. */
export async function getClosedDatesInRange(startDate: string, endDate: string): Promise<Record<string, string>> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("closed_dates")
    .select("date, reason")
    .gte("date", startDate)
    .lte("date", endDate);
  if (error) return {};
  const closed: Record<string, string> = {};
  for (const row of data || []) closed[row.date] = row.reason;
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
