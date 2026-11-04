import { createServiceClient } from "@/lib/supabase/server";
import { BOOKING_RULE_KEYS, DEFAULT_BOOKING_RULES, parseBookingRules, type BookingRules } from "@/lib/booking-rules";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// System rules from Settings > Booking Rules, with the office's own limits applied when it sets them.
export async function getBookingRules(officeId?: string | null): Promise<BookingRules> {
  let rules = DEFAULT_BOOKING_RULES;
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", BOOKING_RULE_KEYS);

    const values: Record<string, string> = {};
    data?.forEach((row) => { values[row.key] = row.value; });
    rules = parseBookingRules(values);

    if (officeId && UUID_REGEX.test(officeId)) {
      const { data: office } = await supabase
        .from("offices")
        .select("max_advance_days, min_notice_hours")
        .eq("id", officeId)
        .maybeSingle();
      rules = {
        maxAdvanceDays: office?.max_advance_days ?? rules.maxAdvanceDays,
        minNoticeHours: office?.min_notice_hours ?? rules.minNoticeHours,
      };
    }
  } catch {
    // Falls back to whatever was loaded so far.
  }
  return rules;
}
