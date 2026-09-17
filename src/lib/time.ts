export function formatTimeSlot(time: string): string {
  if (!/^\d{1,2}:\d{2}$/.test(time)) return time;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

export function getManilaToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export const ENTRY_TIMING_NOTE = "Please arrive at Gate 2 by 20 minutes before your scheduled time to allow for security screening. Entry is allowed only from 30 minutes before the scheduled time, and arriving 15 minutes after the scheduled time voids the gate entry code. You will need to reapply for a new appointment.";

export type EntryTimingStatus = "too_early" | "allowed" | "too_late";

export function getEntryTimingStatus(date: string, timeSlot: string, now = new Date()): EntryTimingStatus {
  const scheduledAt = new Date(`${date}T${timeSlot}:00+08:00`).getTime();
  const nowAt = now.getTime();
  if (nowAt < scheduledAt - 30 * 60 * 1000) return "too_early";
  if (nowAt > scheduledAt + 15 * 60 * 1000) return "too_late";
  return "allowed";
}