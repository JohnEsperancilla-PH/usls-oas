// System update popup set by super admins under Settings > System Update Popup.

export const SYSTEM_ALERT_AUDIENCES = [
  { value: "landing", label: "Landing Page", desc: "Visitors on the public booking page, after the welcome message" },
  { value: "admin", label: "Admin Pages", desc: "Super admins and office admins after signing in" },
  { value: "gate", label: "Guard Pages", desc: "Gate users after signing in" },
] as const;

export type SystemAlertAudience = (typeof SYSTEM_ALERT_AUDIENCES)[number]["value"];

export const ALL_SYSTEM_ALERT_AUDIENCES = SYSTEM_ALERT_AUDIENCES.map((audience) => audience.value).join(",");

export const SYSTEM_ALERT_KEYS = [
  "alert_enabled",
  "alert_start",
  "alert_end",
  "alert_headline",
  "alert_message",
  "alert_audience",
  "alert_version",
];

export const SYSTEM_ALERT_HEADLINE_MAX = 200;
export const SYSTEM_ALERT_MESSAGE_MAX = 2000;

export interface SystemAlert {
  // Changes whenever the text changes, so people who dismissed the old text see the new one.
  version: string;
  headline: string;
  message: string;
}

export function parseSystemAlertAudience(value: string | null | undefined): SystemAlertAudience[] {
  const selected = (value ?? ALL_SYSTEM_ALERT_AUDIENCES).split(",");
  return SYSTEM_ALERT_AUDIENCES.map((audience) => audience.value).filter((audience) => selected.includes(audience));
}

export function resolveSystemAlert(
  settings: Record<string, string | undefined>,
  audience: SystemAlertAudience,
  now: Date = new Date()
): SystemAlert | null {
  if (settings.alert_enabled !== "true") return null;
  if (!parseSystemAlertAudience(settings.alert_audience).includes(audience)) return null;

  const startMs = new Date(settings.alert_start ?? "").getTime();
  const endMs = new Date(settings.alert_end ?? "").getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;
  if (now.getTime() < startMs || now.getTime() > endMs) return null;

  const headline = settings.alert_headline?.trim();
  const message = settings.alert_message?.trim();
  if (!headline || !message) return null;

  return { version: settings.alert_version || settings.alert_start || "", headline, message };
}
