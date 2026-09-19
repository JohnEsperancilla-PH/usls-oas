import { NextResponse, after } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin } from "@/lib/rbac";
import { createUniqueReference } from "@/lib/reference";
import { runPostApprovalTasks } from "@/lib/appointment-actions";
import { mirrorAppointmentToCpanel, fromAppointmentRow } from "@/lib/cpanel-mirror";

export async function POST(request: Request) {
  try {
    const { admin, error: authError, status: authStatus } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: authError }, { status: authStatus });

    const body = await request.json();

    if (!body.appointmentId) {
      return NextResponse.json({ message: "Appointment ID is required" }, { status: 400 });
    }

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

    const referenceNumber = await createUniqueReference(supabase);
    const updatedAt = new Date().toISOString();

    const { error: updateError, data: updated } = await supabase
      .from("appointments")
      .update({
        status: "approved",
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
        qr_token: referenceNumber,
        qr_used_at: null,
        scanned_at: null,
        updated_at: updatedAt,
      })
    );

    // Email and calendar run post-response; failures don't block the approval.
    after(async () => {
      await runPostApprovalTasks(appointment, referenceNumber, admin.id, admin.email);
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
