import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, logAudit } from "@/lib/rbac";
import { validateCsrfToken, csrfErrorResponse } from "@/lib/csrf";
import { OFFICE_ADMIN_FIELDS, validateOfficeSettings } from "@/lib/office-settings";
import { deleteInactiveOffice, getOfficeDeleteCheck } from "@/lib/office-delete";

// Sub-offices tab: an office admin manages the sub-offices of their own office,
// once a super admin has switched on "Allow Sub-offices" for it.
async function getParentOffice(request: Request) {
  const { admin, error, status } = await getAuthAdmin(request);
  if (!admin) return { response: NextResponse.json({ message: error }, { status }) };
  if (admin.role !== "office_admin" || !admin.office_id) {
    return { response: NextResponse.json({ message: "Sub-offices are managed by the main office's admins" }, { status: 403 }) };
  }

  const supabase = createServiceClient();
  const { data: parent } = await supabase.from("offices").select("*").eq("id", admin.office_id).maybeSingle();
  if (!parent?.allow_sub_offices) {
    return { response: NextResponse.json({ message: "Sub-offices aren't enabled for your office" }, { status: 403 }) };
  }
  return { admin, parent, supabase };
}

function validateName(value: unknown): string | { error: string } {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) return { error: "Sub-office name is required" };
  if (name.length > 100) return { error: "Sub-office name is too long (max 100 characters)" };
  return name;
}

function pickOfficeFields(body: Record<string, unknown>) {
  return Object.fromEntries(OFFICE_ADMIN_FIELDS.filter((key) => key in body).map((key) => [key, body[key]]));
}

// The sub-office with this id, if it belongs to the admin's office.
async function findOwnSubOffice(result: { parent: { id: string }; supabase: ReturnType<typeof createServiceClient> }, id: unknown) {
  if (typeof id !== "string" || !id) return null;
  const { data } = await result.supabase.from("offices").select("id, parent_office_id").eq("id", id).maybeSingle();
  return data && data.parent_office_id === result.parent.id ? data : null;
}

export async function GET(request: Request) {
  try {
    const result = await getParentOffice(request);
    if ("response" in result) return result.response;

    // ?deleteCheck=<id>: what deleting that sub-office would remove, and anything blocking it.
    const deleteCheckId = new URL(request.url).searchParams.get("deleteCheck");
    if (deleteCheckId) {
      if (!(await findOwnSubOffice(result, deleteCheckId))) return NextResponse.json({ message: "Sub-office not found" }, { status: 404 });
      const usage = await getOfficeDeleteCheck(deleteCheckId);
      if (!usage) return NextResponse.json({ message: "Sub-office not found" }, { status: 404 });
      return NextResponse.json(usage);
    }

    const { data, error } = await result.supabase.from("offices").select("*").eq("parent_office_id", result.parent.id).order("name");
    if (error) return NextResponse.json({ message: "Failed to load sub-offices" }, { status: 500 });

    return NextResponse.json({ parent: { id: result.parent.id, name: result.parent.name }, subOffices: data || [] });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  const csrfValid = await validateCsrfToken(request);
  if (!csrfValid) return csrfErrorResponse();

  try {
    const result = await getParentOffice(request);
    if ("response" in result) return result.response;

    const body = await request.json().catch(() => ({}));
    const name = validateName(body.name);
    if (typeof name !== "string") return NextResponse.json({ message: name.error }, { status: 400 });
    const validated = validateOfficeSettings(pickOfficeFields(body));
    if ("error" in validated) return NextResponse.json({ message: validated.error }, { status: 400 });

    const { data, error } = await result.supabase
      .from("offices")
      .insert({
        operating_hours: result.parent.operating_hours || "8:00 AM - 5:00 PM",
        capacity_per_slot: 1,
        hide_time_slots: false,
        ...validated.updates,
        name,
        // Grouped with the main office on the booking form.
        category: result.parent.category,
        parent_office_id: result.parent.id,
        allow_sub_offices: false,
        can_invite_for_other_offices: false,
        active: true,
      })
      .select()
      .single();

    if (error || !data) {
      console.error(error);
      return NextResponse.json({ message: "Failed to create sub-office" }, { status: 500 });
    }

    await logAudit(result.admin.id, result.admin.email, "create_office", {
      office_id: data.id,
      meta: { name, parent_office: result.parent.name, source: "sub_offices" },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  const csrfValid = await validateCsrfToken(request);
  if (!csrfValid) return csrfErrorResponse();

  try {
    const result = await getParentOffice(request);
    if ("response" in result) return result.response;

    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    if (!(await findOwnSubOffice(result, id))) {
      return NextResponse.json({ message: "Sub-office not found" }, { status: 404 });
    }

    const validated = validateOfficeSettings(pickOfficeFields(body));
    if ("error" in validated) return NextResponse.json({ message: validated.error }, { status: 400 });
    const updates: Record<string, unknown> = { ...validated.updates };
    if ("name" in body) {
      const name = validateName(body.name);
      if (typeof name !== "string") return NextResponse.json({ message: name.error }, { status: 400 });
      updates.name = name;
    }
    if ("active" in body) {
      if (typeof body.active !== "boolean") return NextResponse.json({ message: "Active must be on or off" }, { status: 400 });
      updates.active = body.active;
    }
    if (Object.keys(updates).length === 0) return NextResponse.json({ message: "No changes to save" }, { status: 400 });

    const { error } = await result.supabase.from("offices").update(updates).eq("id", id);
    if (error) {
      console.error(error);
      return NextResponse.json({ message: "Failed to update sub-office" }, { status: 500 });
    }

    await logAudit(result.admin.id, result.admin.email, "update_office", {
      office_id: id,
      meta: { ...updates, parent_office: result.parent.name, source: "sub_offices" },
    });

    return NextResponse.json({ message: "Sub-office updated" });
  } catch (error) {
    return handleRouteError(error);
  }
}

// Permanently deletes one of the admin's sub-offices, with the same safeguards as deleting an office.
export async function DELETE(request: Request) {
  const csrfValid = await validateCsrfToken(request);
  if (!csrfValid) return csrfErrorResponse();

  try {
    const result = await getParentOffice(request);
    if ("response" in result) return result.response;

    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    if (!(await findOwnSubOffice(result, id))) {
      return NextResponse.json({ message: "Sub-office not found" }, { status: 404 });
    }

    const usage = await getOfficeDeleteCheck(id);
    if (!usage) return NextResponse.json({ message: "Sub-office not found" }, { status: 404 });
    if (usage.blockers.length > 0) {
      return NextResponse.json({ message: usage.blockers.join(" ") }, { status: 409 });
    }
    if (typeof body.confirmName !== "string" || body.confirmName.trim() !== usage.name.trim()) {
      return NextResponse.json({ message: "Type the sub-office name exactly to confirm" }, { status: 400 });
    }

    if (!(await deleteInactiveOffice(id))) {
      return NextResponse.json({ message: "Failed to delete sub-office" }, { status: 500 });
    }

    // The sub-office row is gone, so the main office goes in office_id and the deleted id in the details.
    await logAudit(result.admin.id, result.admin.email, "permanently_delete_office", {
      office_id: result.parent.id,
      meta: { name: usage.name, deleted_office_id: id, appointments_deleted: usage.totalAppointments, parent_office: result.parent.name, source: "sub_offices" },
    });

    return NextResponse.json({ message: "Sub-office deleted" });
  } catch (error) {
    return handleRouteError(error);
  }
}
