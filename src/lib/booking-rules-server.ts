import { createServiceClient } from "@/lib/supabase/server";
import { BOOKING_RULE_KEYS, DEFAULT_BOOKING_RULES, parseBookingRules, type BookingRules } from "@/lib/booking-rules";

export async function getBookingRules(): Promise<BookingRules> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", BOOKING_RULE_KEYS);

    const values: Record<string, string> = {};
    data?.forEach((row) => { values[row.key] = row.value; });
    return parseBookingRules(values);
  } catch {
    return DEFAULT_BOOKING_RULES;
  }
}
