export const MAINTENANCE_KEYS = [
  "maintenance_enabled",
  "maintenance_scheduled",
  "maintenance_start",
  "maintenance_end",
  "maintenance_headline",
  "maintenance_message",
  "maintenance_contact_email",
  "maintenance_updated_at",
] as const;

export const MAINTENANCE_DEFAULT_HEADLINE = "We are currently under maintenance";
export const MAINTENANCE_DEFAULT_MESSAGE =
  "The Online Appointment System is temporarily unavailable while we perform scheduled maintenance. Please check back later. Existing appointments remain valid and are not affected by this downtime.";

const MANILA_OFFSET_MINUTES = 8 * 60;

export type MaintenanceWindowState = "upcoming" | "running" | "ended";

export interface MaintenanceState {
  active: boolean;
  reason: "manual" | "scheduled" | null;
  enabled: boolean;
  scheduled: boolean;
  headline: string;
  message: string;
  contactEmail: string;
  startAt: string | null;
  endAt: string | null;
  updatedAt: string | null;
  windowState: MaintenanceWindowState | null;
  remainingMs: number | null;
}

export const INACTIVE_MAINTENANCE: MaintenanceState = {
  active: false,
  reason: null,
  enabled: false,
  scheduled: false,
  headline: MAINTENANCE_DEFAULT_HEADLINE,
  message: MAINTENANCE_DEFAULT_MESSAGE,
  contactEmail: "",
  startAt: null,
  endAt: null,
  updatedAt: null,
  windowState: null,
  remainingMs: null,
};

function readTimestamp(value: string | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function resolveMaintenance(
  settings: Record<string, string>,
  now: Date = new Date()
): MaintenanceState {
  const enabled = settings.maintenance_enabled === "true";
  const scheduled = settings.maintenance_scheduled === "true";
  const startMs = readTimestamp(settings.maintenance_start);
  const endMs = readTimestamp(settings.maintenance_end);
  const nowMs = now.getTime();

  const hasStarted = startMs === null || nowMs >= startMs;
  const notEnded = endMs === null || nowMs <= endMs;
  const inWindow = scheduled && hasStarted && notEnded;

  let windowState: MaintenanceWindowState | null = null;
  if (scheduled) {
    if (!hasStarted) windowState = "upcoming";
    else if (!notEnded) windowState = "ended";
    else windowState = "running";
  }

  return {
    active: enabled || inWindow,
    reason: enabled ? "manual" : inWindow ? "scheduled" : null,
    enabled,
    scheduled,
    headline: settings.maintenance_headline?.trim() || MAINTENANCE_DEFAULT_HEADLINE,
    message: settings.maintenance_message?.trim() || MAINTENANCE_DEFAULT_MESSAGE,
    contactEmail: settings.maintenance_contact_email?.trim() || "",
    startAt: settings.maintenance_start?.trim() || null,
    endAt: settings.maintenance_end?.trim() || null,
    updatedAt: settings.maintenance_updated_at || null,
    windowState,
    remainingMs: endMs === null ? null : Math.max(0, endMs - nowMs),
  };
}

export function toManilaInputValue(iso: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  return new Date(ms + MANILA_OFFSET_MINUTES * 60_000).toISOString().slice(0, 16);
}

export function fromManilaInputValue(value: string): string | null {
  if (!value) return null;
  const ms = new Date(`${value}:00+08:00`).getTime();
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

export function formatManilaDateTime(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return `${new Date(ms).toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })} PHT`;
}
