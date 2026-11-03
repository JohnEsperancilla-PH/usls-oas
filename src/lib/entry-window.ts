// Gate entry window set by super admins under Settings > Gate Entry Window.
// Both limits are minutes relative to the appointment's scheduled time.

export interface EntryWindow {
  earlyMinutes: number;
  lateMinutes: number;
}

export const DEFAULT_ENTRY_WINDOW: EntryWindow = { earlyMinutes: 30, lateMinutes: 60 };

export const ENTRY_WINDOW_KEYS = ["entry_early_minutes", "entry_late_minutes"];

export const MAX_ENTRY_WINDOW_MINUTES = 240;

// Suggested arrival lead time for security screening; never earlier than entry opens.
const SCREENING_LEAD_MINUTES = 20;

export function parseEntryWindow(values: Record<string, string | null | undefined>): EntryWindow {
  const toMinutes = (value: string | null | undefined, fallback: number) => {
    const n = parseInt(value ?? "", 10);
    return Number.isFinite(n) ? Math.min(MAX_ENTRY_WINDOW_MINUTES, Math.max(0, n)) : fallback;
  };
  return {
    earlyMinutes: toMinutes(values.entry_early_minutes, DEFAULT_ENTRY_WINDOW.earlyMinutes),
    lateMinutes: toMinutes(values.entry_late_minutes, DEFAULT_ENTRY_WINDOW.lateMinutes),
  };
}

export function describeMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  if (minutes > 0 || hours === 0) parts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
  return parts.join(" ");
}

// e.g. "30 minutes before the scheduled time"
export function describeEntryOpening(window: EntryWindow): string {
  return window.earlyMinutes > 0 ? `${describeMinutes(window.earlyMinutes)} before the scheduled time` : "at the scheduled time";
}

// e.g. "more than 1 hour after the scheduled time"
export function describeEntryCutoff(window: EntryWindow): string {
  return window.lateMinutes > 0 ? `more than ${describeMinutes(window.lateMinutes)} after the scheduled time` : "after the scheduled time";
}

export function getArrivalNote(window: EntryWindow): string {
  const lead = Math.min(SCREENING_LEAD_MINUTES, window.earlyMinutes);
  return lead > 0
    ? `Please arrive at Gate 2 by ${describeMinutes(lead)} before your scheduled time.`
    : "Please arrive at Gate 2 at your scheduled time.";
}

export function getEntryRuleNote(window: EntryWindow): string {
  return `Entry opens ${describeEntryOpening(window)}. Arriving ${describeEntryCutoff(window)} voids the gate entry code.`;
}

export function getEntryTimingNote(window: EntryWindow): string {
  return `${getArrivalNote(window)} ${getEntryRuleNote(window)} You will need to reapply for a new appointment.`;
}
