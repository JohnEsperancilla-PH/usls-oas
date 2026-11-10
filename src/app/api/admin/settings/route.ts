import { NextResponse } from "next/server";
import { getAuthAdmin, logAudit, requireSuperAdmin } from "@/lib/rbac";
import { diffChanges } from "@/lib/audit";
import { createServiceClient } from "@/lib/supabase/server";
import { validateCsrfToken, csrfErrorResponse } from "@/lib/csrf";
import { MAX_ENTRY_WINDOW_MINUTES } from "@/lib/entry-window";
import { EMAIL_TEMPLATE_GROUPS, EMAIL_TEMPLATE_KEYS, findUnknownPlaceholder, getAllowedPlaceholders, getEmailFieldMaxLength, getEmailFields, type EmailField } from "@/lib/email-templates";
import { fromManilaInputValue } from "@/lib/maintenance";
import { ALL_SYSTEM_ALERT_AUDIENCES, SYSTEM_ALERT_HEADLINE_MAX, SYSTEM_ALERT_MESSAGE_MAX, parseSystemAlertAudience } from "@/lib/system-alert";
import { getSystemAlertSettings } from "@/lib/system-alert-server";

export async function GET(request: Request) {
  const { admin, error, status } = await getAuthAdmin(request);
  if (!admin) return NextResponse.json({ message: error }, { status });

  const supabase = createServiceClient();
  const { data, error: dbError } = await supabase
    .from("system_settings")
    .select("key, value");

  if (dbError) return NextResponse.json({ message: dbError.message }, { status: 500 });

  const settings: Record<string, string> = {};
  data?.forEach((row) => { settings[row.key] = row.value; });

  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
  const csrfValid = await validateCsrfToken(request);
  if (!csrfValid) return csrfErrorResponse();

  const { admin, error, status } = await getAuthAdmin(request);
  if (!admin) return NextResponse.json({ message: error }, { status });

  const access = requireSuperAdmin(admin);
  if (!access.ok) return NextResponse.json({ message: access.error }, { status: access.status });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ message: "Invalid settings payload" }, { status: 400 });
  }

  // Only keys this page owns are written; anything else (e.g. maintenance settings echoed back from GET) is ignored.
  const values: Record<string, string> = {};
  for (const [key, raw] of Object.entries(body as Record<string, unknown>)) {
    const validate = SETTING_RULES[key];
    if (!validate) continue;
    const result = validate(String(raw ?? "").trim());
    if (typeof result === "object") {
      return NextResponse.json({ message: result.error }, { status: 400 });
    }
    values[key] = result;
  }

  if (Object.keys(values).length === 0) {
    return NextResponse.json({ message: "No settings to update" }, { status: 400 });
  }

  // The popup's fields depend on each other, so they're checked together with what is already saved.
  let alertBefore: Record<string, string> | null = null;
  if (ALERT_EDITABLE_KEYS.some((key) => key in values)) {
    try {
      alertBefore = await getSystemAlertSettings();
    } catch (err) {
      console.error(err);
      return NextResponse.json({ message: "Failed to save settings" }, { status: 500 });
    }
    const alertError = validateAlert({ ...alertBefore, ...values });
    if (alertError) return NextResponse.json({ message: alertError }, { status: 400 });
  }

  const alertChanged = alertBefore !== null && ALERT_EDITABLE_KEYS.some((key) => key in values && values[key] !== alertValue(alertBefore!, key));
  if (alertBefore !== null && (["alert_headline", "alert_message"] as const).some((key) => key in values && values[key] !== alertValue(alertBefore!, key))) {
    values.alert_version = new Date().toISOString();
  }

  const supabase = createServiceClient();

  const emailKeys = EMAIL_TEMPLATE_KEYS.filter((key) => key in values);
  const emailBefore: Record<string, string> = {};
  if (emailKeys.length > 0) {
    const { data: savedText, error: emailReadError } = await supabase.from("system_settings").select("key, value").in("key", emailKeys);
    if (emailReadError) {
      console.error(emailReadError);
      return NextResponse.json({ message: "Failed to save settings" }, { status: 500 });
    }
    savedText?.forEach((row) => { emailBefore[row.key] = row.value; });
  }
  const changedEmails = EMAIL_TEMPLATE_GROUPS.filter((group) =>
    getEmailFields(group).some(({ key }) => key in values && values[key] !== (emailBefore[key] ?? "")));

  // Everything else on the page (system info, booking rules, gate entry window, approvals, email switches)
  // is logged as one "settings" change. The popup and email text have their own entries above and below.
  const settingKeys = Object.keys(values).filter((key) => !key.startsWith("alert_") && !(EMAIL_TEMPLATE_KEYS as readonly string[]).includes(key));
  const settingsBefore: Record<string, string> = {};
  if (settingKeys.length > 0) {
    const { data: savedSettings } = await supabase.from("system_settings").select("key, value").in("key", settingKeys);
    savedSettings?.forEach((row) => { settingsBefore[row.key] = row.value; });
  }
  const settingChanges = diffChanges(settingsBefore, Object.fromEntries(settingKeys.map((key) => [key, values[key]])));

  const updatedAt = new Date().toISOString();
  const { error: upsertError } = await supabase
    .from("system_settings")
    .upsert(Object.entries(values).map(([key, value]) => ({ key, value, updated_at: updatedAt })), { onConflict: "key" });

  if (upsertError) {
    console.error(upsertError);
    return NextResponse.json({ message: "Failed to save settings" }, { status: 500 });
  }

  if (alertChanged) {
    const saved = { ...alertBefore, ...values };
    await logAudit(admin.id, admin.email, "update_system_alert", {
      meta: {
        enabled: saved.alert_enabled === "true",
        headline: saved.alert_headline,
        audience: saved.alert_audience,
        startAt: saved.alert_start,
        endAt: saved.alert_end,
        changes: diffChanges(
          Object.fromEntries(ALERT_EDITABLE_KEYS.map((key) => [key, alertValue(alertBefore!, key)])),
          Object.fromEntries(ALERT_EDITABLE_KEYS.filter((key) => key in values).map((key) => [key, values[key]])),
        ),
      },
    });

    // A switched-on popup with new text is a release note on /updates. Same text isn't listed twice.
    const headline = (saved.alert_headline || "").trim();
    if (saved.alert_enabled === "true" && headline) {
      const message = (saved.alert_message || "").trim();
      const { data: latest } = await supabase
        .from("system_updates")
        .select("headline, message")
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!latest || latest.headline !== headline || latest.message !== message) {
        const { error: historyError } = await supabase.from("system_updates").insert({
          headline,
          message,
          audience: saved.alert_audience || ALL_SYSTEM_ALERT_AUDIENCES,
          published_by_email: admin.email,
        });
        // Missing table (migration 048 not applied) shouldn't fail the save.
        if (historyError) console.error("Failed to record system update:", historyError.message);
      }
    }
  }

  if (Object.keys(settingChanges).length > 0) {
    await logAudit(admin.id, admin.email, "update_settings", { meta: { name: "System settings", changes: settingChanges } });
  }

  if (changedEmails.length > 0) {
    await logAudit(admin.id, admin.email, "update_email_templates", {
      meta: { emails: changedEmails.join(", "), changes: diffChanges(emailBefore, Object.fromEntries(emailKeys.map((key) => [key, values[key]]))) },
    });
  }

  return NextResponse.json({ message: "Settings updated" });
}

const ALERT_EDITABLE_KEYS = ["alert_enabled", "alert_start", "alert_end", "alert_headline", "alert_message", "alert_audience"];

// What an unsaved field means, so a first save of the Settings page doesn't count as a popup change.
function alertValue(settings: Record<string, string>, key: string): string {
  return settings[key] ?? (key === "alert_enabled" ? "false" : key === "alert_audience" ? ALL_SYSTEM_ALERT_AUDIENCES : "");
}

function validateAlert(settings: Record<string, string>): string | null {
  if (settings.alert_enabled !== "true") return null;
  if (!settings.alert_headline) return "The system update popup needs a headline";
  if (!settings.alert_message) return "The system update popup needs a message";
  if (!settings.alert_start || !settings.alert_end) return "The system update popup needs a start and end time";
  if (new Date(settings.alert_end).getTime() <= new Date(settings.alert_start).getTime()) return "The system update popup must end after it starts";
  if (parseSystemAlertAudience(settings.alert_audience).length === 0) return "Choose where the system update popup appears";
  return null;
}

const alertTime = (label: string): SettingRule => (v) => {
  if (!v) return "";
  return fromManilaInputValue(v) ?? { error: `${label} is not a valid date and time` };
};

type SettingRule = (value: string) => string | { error: string };

const flag = (label: string): SettingRule => (v) =>
  v === "true" || v === "false" ? v : { error: `${label} must be on or off` };

const wholeNumber = (label: string, min: number, max: number): SettingRule => (v) => {
  const n = Number(v);
  return v !== "" && Number.isInteger(n) && n >= min && n <= max ? String(n) : { error: `${label} must be a whole number from ${min} to ${max}` };
};

const emailText = (def: EmailField): SettingRule => (v) => {
  const max = getEmailFieldMaxLength(def);
  if (v.length > max) return { error: `Email ${def.label} must be ${max} characters or fewer` };
  const unknown = findUnknownPlaceholder(v, def);
  if (!unknown) return v;
  const allowed = getAllowedPlaceholders(def).map((p) => `{${p}}`).join(", ");
  return { error: `Email ${def.label} can't use ${unknown}. ${allowed ? `Available: ${allowed}` : "This field doesn't use placeholders."}` };
};

const EMAIL_TEMPLATE_RULES = Object.fromEntries(EMAIL_TEMPLATE_GROUPS.flatMap((group) =>
  getEmailFields(group).map(({ key, def }) => [key, emailText(def)])));

const SETTING_RULES: Record<string, SettingRule> = {
  ...EMAIL_TEMPLATE_RULES,
  system_name: (v) => (v && v.length <= 100 ? v : { error: "System name is required (max 100 characters)" }),
  support_email: (v) => (!v || (v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) ? v : { error: "Support email is not a valid email address" }),
  support_phone: (v) => (v.length <= 30 ? v : { error: "Support phone is too long (max 30 characters)" }),
  max_advance_days: wholeNumber("Max advance booking", 1, 365),
  min_notice_hours: wholeNumber("Minimum notice", 0, 168),
  booking_max_advance_enabled: flag("Max advance booking"),
  booking_min_notice_enabled: flag("Minimum notice"),
  entry_early_minutes: wholeNumber("Earliest entry", 0, MAX_ENTRY_WINDOW_MINUTES),
  entry_late_minutes: wholeNumber("Latest entry", 0, MAX_ENTRY_WINDOW_MINUTES),
  require_account_approval: flag("Manual account approval"),
  alert_enabled: flag("System update popup"),
  alert_start: alertTime("Popup start"),
  alert_end: alertTime("Popup end"),
  alert_headline: (v) => (v.length <= SYSTEM_ALERT_HEADLINE_MAX ? v : { error: `Popup headline must be ${SYSTEM_ALERT_HEADLINE_MAX} characters or fewer` }),
  alert_message: (v) => (v.length <= SYSTEM_ALERT_MESSAGE_MAX ? v : { error: `Popup message must be ${SYSTEM_ALERT_MESSAGE_MAX} characters or fewer` }),
  alert_audience: (v) => parseSystemAlertAudience(v).join(","),
  notify_confirmation: flag("Booking confirmation email"),
  notify_admin_alert: flag("Admin alert email"),
  notify_approval: flag("Approval email"),
  notify_decline: flag("Decline email"),
  notify_postponement: flag("Postponement email"),
  notify_invitation: flag("Invitation email"),
  notify_qr_resend: flag("Reference re-send email"),
};
