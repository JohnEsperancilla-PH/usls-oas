import { NextResponse, after } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, logAudit, requireDashboardAdmin } from "@/lib/rbac";
import { validateCsrfToken, csrfErrorResponse } from "@/lib/csrf";
import { canAccessAppointment, canManageOffice } from "@/lib/office-scope";
import { filterSubOfficeIds, notifyTaggedSubOffices } from "@/lib/sub-office-tags";

// Sub-offices tagged on an appointment, and which ones can be tagged.
// Tagging is done by admins of the appointment's own office (or super admins).
async function loadAppointment(request: Request, appointmentId: string) {
  const { admin, error, status } = await getAuthAdmin(request);
  if (!admin) return { response: NextResponse.json({ message: error }, { status }) };
  const access = requireDashboardAdmin(admin);
  if (!access.ok) return { response: NextResponse.json({ message: access.error }, { status: access.status }) };

  const supabase = createServiceClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, office_id, full_name, date, time_slot, status")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appointment || !(await canAccessAppointment(admin, appointment))) {
    return { response: NextResponse.json({ message: "Appointment not found" }, { status: 404 }) };
  }
  return { admin, appointment, supabase, canTag: await canManageOffice(admin, appointment.office_id) };
}

export async function GET(request: Request) {
  try {
    const appointmentId = new URL(request.url).searchParams.get("appointmentId") || "";
    const result = await loadAppointment(request, appointmentId);
    if ("response" in result) return result.response;

    const [{ data: subOffices }, { data: tags }] = await Promise.all([
      result.supabase.from("offices").select("id, name, active").eq("parent_office_id", result.appointment.office_id).order("name"),
      result.supabase.from("appointment_office_tags").select("office_id").eq("appointment_id", appointmentId),
    ]);

    return NextResponse.json({
      canTag: result.canTag,
      subOffices: (subOffices || []).map((office) => ({ id: office.id, name: office.name, active: office.active })),
      taggedOfficeIds: (tags || []).map((tag) => tag.office_id),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

// Replaces the appointment's tagged sub-offices; newly tagged ones are emailed.
export async function PUT(request: Request) {
  const csrfValid = await validateCsrfToken(request);
  if (!csrfValid) return csrfErrorResponse();

  try {
    const body = await request.json().catch(() => ({}));
    const appointmentId = typeof body.appointmentId === "string" ? body.appointmentId : "";
    const result = await loadAppointment(request, appointmentId);
    if ("response" in result) return result.response;
    if (!result.canTag) return NextResponse.json({ message: "Only the main office can tag sub-offices" }, { status: 403 });

    const officeIds = await filterSubOfficeIds(result.appointment.office_id, body.officeIds);
    if (officeIds === null) return NextResponse.json({ message: "Only this office's sub-offices can be tagged" }, { status: 400 });

    const { data: existing } = await result.supabase.from("appointment_office_tags").select("office_id").eq("appointment_id", appointmentId);
    const before = new Set((existing || []).map((tag) => tag.office_id));
    const added = officeIds.filter((id) => !before.has(id));
    const removed = [...before].filter((id) => !officeIds.includes(id));

    if (removed.length > 0) {
      const { error } = await result.supabase.from("appointment_office_tags").delete().eq("appointment_id", appointmentId).in("office_id", removed);
      if (error) return NextResponse.json({ message: "Failed to update tagged sub-offices" }, { status: 500 });
    }
    if (added.length > 0) {
      const { error } = await result.supabase.from("appointment_office_tags")
        .insert(added.map((officeId) => ({ appointment_id: appointmentId, office_id: officeId, tagged_by_email: result.admin.email })));
      if (error) return NextResponse.json({ message: "Failed to update tagged sub-offices" }, { status: 500 });
    }

    if (added.length > 0 || removed.length > 0) {
      await logAudit(result.admin.id, result.admin.email, "tag_sub_office", {
        appointment_id: appointmentId,
        office_id: result.appointment.office_id,
        meta: { visitor_name: result.appointment.full_name, added, removed },
      });
      const origin = new URL(request.url).origin;
      after(async () => { await notifyTaggedSubOffices(result.appointment, added, origin); });
    }

    return NextResponse.json({ message: "Tagged sub-offices updated", taggedOfficeIds: officeIds });
  } catch (error) {
    return handleRouteError(error);
  }
}
