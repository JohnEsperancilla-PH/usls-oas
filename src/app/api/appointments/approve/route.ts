import { NextResponse, after } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, requireDashboardAdmin } from "@/lib/rbac";
import { createUniqueReference } from "@/lib/reference";
import { runPostApprovalTasks } from "@/lib/appointment-actions";
import { mirrorAppointmentToCpanel, fromAppointmentRow } from "@/lib/cpanel-mirror";
import { validateCsrfToken, csrfErrorResponse } from "@/lib/csrf";

export async function POST(request: Request) {
  const csrfValid = await validateCsrfToken(request);
  if (!csrfValid) return csrfErrorResponse();

  try {
    const { admin, error: authError, status: authStatus } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: authError }, { status: authStatus });
    const dashboardAccess = requireDashboardAdmin(admin);
    if (!dashboardAccess.ok) return NextResponse.json({ message: dashboardAccess.error }, { status: dashboardAccess.status });

    const body = await request.json();

    if (!body.appointmentId) {
      return NextResponse.json({ message: "Appointment ID is required" }, { status: 400 });
    }

    const personToMeetEmail = body.personToMeetEmail as string | undefined;

    const supabase = createServiceClient();

    const { data: appointment, error: fetchError } = await supabase
      .from("appointments")
      .select("*, offices(*)")
      .eq("id", body.appointmentId)
      .single();

    if (fetchError || !appointment) {
      return NextResponse.json({ message: "Appointment not found" }, { status: 404 });
    }

    if (admin.role === "office_admin" && admin.office_id !== appointment.office_id) {
      return NextResponse.json({ message: "You can only approve appointments for your office" }, { status: 403 });
    }

    if (appointment.status !== "pending" && appointment.status !== "postponed") {
      return NextResponse.json({ message: "Appointment is not in pending or postponed status" }, { status: 400 });
    }

    const requestedTimeSlot = typeof body.timeSlot === "string" && body.timeSlot.trim() ? body.timeSlot.trim() : undefined;
    if (requestedTimeSlot && !/^\d{2}:(00|30)$/.test(requestedTimeSlot)) {
      return NextResponse.json({ message: "Invalid time slot format" }, { status: 400 });
    }

    const effectiveTimeSlot = requestedTimeSlot || appointment.time_slot || null;
    if (!effectiveTimeSlot) {
      return NextResponse.json({ message: "Please select a time before approving this appointment." }, { status: 400 });
    }

    const referenceNumber = await createUniqueReference(supabase);
    const updatedAt = new Date().toISOString();

    const { error: updateError, data: updated } = await supabase
      .from("appointments")
      .update({
        status: "approved",
        time_slot: effectiveTimeSlot,
        qr_token: referenceNumber,
        qr_used_at: null,
        scanned_at: null,
        updated_at: updatedAt,
      })
      .eq("id", appointment.id)
      .in("status", ["pending", "postponed"])
      .select("id")
      .maybeSingle();

    if (updateError) {
      console.error(updateError);
      return NextResponse.json({ message: "Failed to update appointment" }, { status: 500 });
    }

    if (!updated) {
      return NextResponse.json({ message: "This appointment was already reviewed. Refresh to see its current status." }, { status: 409 });
    }

    await mirrorAppointmentToCpanel(
      fromAppointmentRow(appointment, {
        status: "approved",
        time_slot: effectiveTimeSlot,
        qr_token: referenceNumber,
        qr_used_at: null,
        scanned_at: null,
        updated_at: updatedAt,
      })
    );

    // Email and calendar run post-response; failures don't block the approval.
    after(async () => {
      await runPostApprovalTasks(appointment, referenceNumber, admin.id, admin.email, personToMeetEmail, effectiveTimeSlot);
    });

    return NextResponse.json({
      message: "Appointment approved successfully",
      emailSent: null,
      emailPending: true,
      appointment: { id: appointment.id, status: "approved" },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
