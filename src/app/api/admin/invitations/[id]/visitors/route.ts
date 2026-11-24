import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, isDashboardRole, logAudit } from "@/lib/rbac";
import { validateCsrfToken, csrfErrorResponse } from "@/lib/csrf";
import { canAccessAppointment } from "@/lib/office-scope";
import { getAppointmentVisitors } from "@/lib/appointment-visitors";
import { mirrorAppointmentToCpanel, fromAppointmentRow } from "@/lib/cpanel-mirror";
import { isValidId } from "@/lib/valid-ids";
import {
  buildInvitationVisitorRows,
  canEditInvitationVisitors,
  currentInvitationVisitors,
  parseAdditionalInvitationVisitors,
} from "@/lib/invitation-visitors";

// Change the names on an invitation before the visitors arrive. The gate reads names from the
// appointment and appointment_visitors on every scan, and the ticket PDF is generated from them
// on each download, so both show the new names right away. The visitor count stays fixed.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrfValid = await validateCsrfToken(request);
  if (!csrfValid) return csrfErrorResponse();

  try {
    const { id } = await params;

    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });
    if (!isDashboardRole(admin.role)) return NextResponse.json({ message: "Insufficient permissions" }, { status: 403 });

    const supabase = createServiceClient();
    const { data: appointment, error: fetchError } = await supabase
      .from("appointments")
      .select("*, offices(*)")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !appointment) {
      return NextResponse.json({ message: "Invitation not found" }, { status: 404 });
    }
    if (!appointment.is_invitation) {
      return NextResponse.json({ message: "Only invitations can have their visitor names edited" }, { status: 400 });
    }
    if (admin.role === "office_admin" && admin.office_id !== appointment.invited_by_office_id && !(await canAccessAppointment(admin, appointment))) {
      return NextResponse.json({ message: "You can only edit invitations for your office" }, { status: 403 });
    }
    if (!canEditInvitationVisitors(appointment)) {
      return NextResponse.json({ message: "Visitor names can no longer be changed: this invitation has already been used, denied, expired or cancelled" }, { status: 409 });
    }

    const body = await request.json();
    const visitors: unknown = body?.visitors;
    const before = currentInvitationVisitors(appointment, await getAppointmentVisitors(supabase, appointment.id));

    if (!Array.isArray(visitors) || visitors.length !== before.length) {
      return NextResponse.json({ message: `This invitation has ${before.length} visitor slot${before.length !== 1 ? "s" : ""}; send a name for each` }, { status: 400 });
    }

    const [mainRaw, ...additionalRaw] = visitors as { fullName?: unknown; validId?: unknown }[];
    const mainName = typeof mainRaw?.fullName === "string" ? mainRaw.fullName.trim() : "";
    const mainValidId = typeof mainRaw?.validId === "string" ? mainRaw.validId.trim() : "";
    if (!mainName) return NextResponse.json({ message: "The main visitor's name is required" }, { status: 400 });
    if (mainName.length > 100) return NextResponse.json({ message: "Name is too long (max 100 characters)" }, { status: 400 });
    if (mainValidId && !isValidId(mainValidId)) return NextResponse.json({ message: "Please select a valid government-issued ID" }, { status: 400 });

    const parsed = parseAdditionalInvitationVisitors(additionalRaw, before.length - 1);
    if (!parsed.ok) return NextResponse.json({ message: parsed.message }, { status: 400 });

    const after = [{ fullName: mainName, validId: mainValidId }, ...parsed.visitors];
    const changed = after
      .map((visitor, index) => ({ index, before: before[index], after: visitor }))
      .filter(({ before: prev, after: next }) => prev.fullName !== next.fullName || prev.validId !== next.validId);

    if (changed.length === 0) {
      return NextResponse.json({ message: "No changes to save" });
    }

    // Change the appointment first, conditioned on it still being unused, so an edit can't land
    // after the guard has already let the group in.
    const updatedAt = new Date().toISOString();
    const appointmentChanges = { full_name: mainName, valid_id: mainValidId || null, updated_at: updatedAt };
    const { data: updated, error: updateError } = await supabase
      .from("appointments")
      .update(appointmentChanges)
      .eq("id", appointment.id)
      .in("status", ["approved", "postponed"])
      .is("qr_used_at", null)
      .select("id")
      .maybeSingle();
    if (updateError) {
      console.error(updateError);
      return NextResponse.json({ message: "Failed to update invitation" }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ message: "This invitation was just used at the gate, so the names can no longer be changed" }, { status: 409 });
    }

    const rows = buildInvitationVisitorRows(appointment.id, after[0], after.slice(1));
    const { error: visitorsError } = await supabase
      .from("appointment_visitors")
      .upsert(rows, { onConflict: "appointment_id,visitor_number" });
    if (visitorsError) {
      console.error(visitorsError);
      return NextResponse.json({ message: "Failed to save visitor names" }, { status: 500 });
    }

    await mirrorAppointmentToCpanel(fromAppointmentRow(appointment, { full_name: mainName, valid_id: mainValidId || null, updated_at: updatedAt }));

    const label = (visitor: { fullName: string; validId: string }) => `${visitor.fullName}${visitor.validId ? ` (${visitor.validId})` : ""}`;
    await logAudit(admin.id, admin.email, "update_invitation_visitors", {
      appointment_id: appointment.id,
      office_id: appointment.office_id,
      meta: {
        visitor_name: mainName,
        reference_number: appointment.qr_token,
        office_name: appointment.offices?.name || null,
        changes: Object.fromEntries(changed.map(({ index, before: prev, after: next }) => [
          index === 0 ? "main_visitor" : `visitor_${index + 1}`,
          { before: label(prev), after: label(next) },
        ])),
      },
    });

    return NextResponse.json({ message: "Visitor names updated. Download the ticket again for the updated PDF.", visitors: after });
  } catch (error) {
    return handleRouteError(error);
  }
}
