// Booking window rules set by super admins under Settings > Booking Rules.
// Dates are Asia/Manila "YYYY-MM-DD" strings and time slots are "HH:MM" Manila wall-clock times.

// A rule that is switched off is null: no advance limit, or no minimum notice.
export interface BookingRules {
  maxAdvanceDays: number | null;
  minNoticeHours: number | null;
}

export const DEFAULT_BOOKING_RULES: BookingRules = { maxAdvanceDays: 30, minNoticeHours: 24 };

export const BOOKING_RULE_KEYS = ["max_advance_days", "min_notice_hours", "booking_max_advance_enabled", "booking_min_notice_enabled"];

// Latest bookable slot of the office day; used when an office hides time slots and only a date is chosen.
const LAST_SLOT_OF_DAY = "16:30";

export function parseBookingRules(values: Record<string, string | null | undefined>): BookingRules {
  const toInt = (value: string | null | undefined, fallback: number, min: number, max: number) => {
    const n = parseInt(value ?? "", 10);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  // Rules count as on unless explicitly switched off, matching how they behaved before the switches existed.
  const isOn = (value: string | null | undefined) => value !== "false";
  return {
    maxAdvanceDays: isOn(values.booking_max_advance_enabled)
      ? toInt(values.max_advance_days, DEFAULT_BOOKING_RULES.maxAdvanceDays!, 1, 365)
      : null,
    minNoticeHours: isOn(values.booking_min_notice_enabled)
      ? toInt(values.min_notice_hours, DEFAULT_BOOKING_RULES.minNoticeHours!, 0, 168)
      : null,
  };
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const result = new Date(Date.UTC(y, m - 1, d + days));
  return result.toISOString().slice(0, 10);
}

// Null when the advance limit is switched off.
export function getLatestBookableDate(rules: BookingRules, today: string): string | null {
  return rules.maxAdvanceDays === null ? null : addDays(today, rules.maxAdvanceDays);
}

export function isTooFar(date: string, rules: BookingRules, today: string): boolean {
  const latest = getLatestBookableDate(rules, today);
  return latest !== null && date > latest;
}

// True when the slot (or, with no slot, the last slot of that day) starts sooner than the minimum notice allows.
export function isTooSoon(date: string, timeSlot: string | null | undefined, rules: BookingRules, now = Date.now()): boolean {
  if (!rules.minNoticeHours) return false;
  const startsAt = new Date(`${date}T${timeSlot || LAST_SLOT_OF_DAY}:00+08:00`).getTime();
  return startsAt < now + rules.minNoticeHours * 60 * 60 * 1000;
}

export function describeNotice(hours: number): string {
  if (hours % 24 === 0 && hours >= 24) {
    const days = hours / 24;
    return `${days} day${days !== 1 ? "s" : ""}`;
  }
  return `${hours} hour${hours !== 1 ? "s" : ""}`;
}
