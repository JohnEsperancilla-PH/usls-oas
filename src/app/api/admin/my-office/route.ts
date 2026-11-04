import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, logAudit } from "@/lib/rbac";
import { validateCsrfToken, csrfErrorResponse } from "@/lib/csrf";
import { getBookingRules } from "@/lib/booking-rules-server";
import { OFFICE_ADMIN_FIELDS, validateOfficeSettings } from "@/lib/office-settings";

// Office Settings: an office admin reads and edits their own office only.
async function getOwnOfficeId(request: Request) {
  const { admin, error, status } = await getAuthAdmin(request);
  if (!admin) return { response: NextResponse.json({ message: error }, { status }) };
  if (admin.role !== "office_admin") {
    return { response: NextResponse.json({ message: "Office Settings is for office admins" }, { status: 403 }) };
  }
  if (!admin.office_id) return { response: NextResponse.json({ message: "No office is assigned to your account" }, { status: 403 }) };
  return { admin, officeId: admin.office_id };
}

export async function GET(request: Request) {
  try {
    const result = await getOwnOfficeId(request);
    if ("response" in result) return result.response;

    const supabase = createServiceClient();
    const { data: office, error: fetchError } = await supabase.from("offices").select("*").eq("id", result.officeId).maybeSingle();
    if (fetchError || !office) return NextResponse.json({ message: "Office not found" }, { status: 404 });

    // The system rules, so the page can show what "use the system setting" means.
    return NextResponse.json({ office, systemRules: await getBookingRules() });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  const csrfValid = await validateCsrfToken(request);
  if (!csrfValid) return csrfErrorResponse();

  try {
    const result = await getOwnOfficeId(request);
    if ("response" in result) return result.response;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ message: "Invalid settings" }, { status: 400 });
    }

    // Only fields office admins own are considered; anything else in the body is ignored.
    const allowed = Object.fromEntries(OFFICE_ADMIN_FIELDS.filter((key) => key in body).map((key) => [key, body[key]]));
    const validated = validateOfficeSettings(allowed);
    if ("error" in validated) return NextResponse.json({ message: validated.error }, { status: 400 });
    if (Object.keys(validated.updates).length === 0) return NextResponse.json({ message: "No changes to save" }, { status: 400 });

    const supabase = createServiceClient();
    const { error: updateError } = await supabase.from("offices").update(validated.updates).eq("id", result.officeId);
    if (updateError) {
      console.error(updateError);
      return NextResponse.json({ message: "Failed to save office settings" }, { status: 500 });
    }

    await logAudit(result.admin.id, result.admin.email, "update_office", {
      office_id: result.officeId,
      meta: { ...validated.updates, source: "office_settings" },
    });

    return NextResponse.json({ message: "Office settings saved" });
  } catch (error) {
    return handleRouteError(error);
  }
}
