import { NextResponse } from "next/server";
import { getAuthAdmin, requireSuperAdmin } from "@/lib/rbac";
import { createServiceClient } from "@/lib/supabase/server";
import { validateCsrfToken, csrfErrorResponse } from "@/lib/csrf";

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

  const supabase = createServiceClient();
  const updatedAt = new Date().toISOString();
  const { error: upsertError } = await supabase
    .from("system_settings")
    .upsert(Object.entries(values).map(([key, value]) => ({ key, value, updated_at: updatedAt })), { onConflict: "key" });

  if (upsertError) {
    console.error(upsertError);
    return NextResponse.json({ message: "Failed to save settings" }, { status: 500 });
  }

  return NextResponse.json({ message: "Settings updated" });
}

type SettingRule = (value: string) => string | { error: string };

const flag = (label: string): SettingRule => (v) =>
  v === "true" || v === "false" ? v : { error: `${label} must be on or off` };

const wholeNumber = (label: string, min: number, max: number): SettingRule => (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? String(n) : { error: `${label} must be a whole number from ${min} to ${max}` };
};

const SETTING_RULES: Record<string, SettingRule> = {
  system_name: (v) => (v && v.length <= 100 ? v : { error: "System name is required (max 100 characters)" }),
  support_email: (v) => (!v || (v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) ? v : { error: "Support email is not a valid email address" }),
  support_phone: (v) => (v.length <= 30 ? v : { error: "Support phone is too long (max 30 characters)" }),
  max_advance_days: wholeNumber("Max advance booking", 1, 365),
  min_notice_hours: wholeNumber("Minimum notice", 0, 168),
  booking_max_advance_enabled: flag("Max advance booking"),
  booking_min_notice_enabled: flag("Minimum notice"),
  notify_confirmation: flag("Booking confirmation email"),
  notify_admin_alert: flag("Admin alert email"),
  notify_approval: flag("Approval email"),
  notify_decline: flag("Decline email"),
  notify_postponement: flag("Postponement email"),
  notify_invitation: flag("Invitation email"),
  notify_qr_resend: flag("Reference re-send email"),
};
