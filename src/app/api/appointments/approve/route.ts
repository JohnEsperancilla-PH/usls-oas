import { NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin } from "@/lib/rbac";
import { createUniqueReference } from "@/lib/reference";
import { runPostApprovalTasks } from "@/lib/appointment-actions";
import { mirrorAppointmentToCpanel, fromAppointmentRow } from "@/lib/cpanel-mirror";

interface ApproveRequest {
  appointmentId: string;
}

export async function POST(request: Request) {
  try {
    const { admin, error: authError, status: authStatus } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: authError }, { status: authStatus });

    const body: ApproveRequest = await request.json();

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

    if (appointment.status !== "pending") {
      return NextResponse.json({ message: "Appointment is not in pending status" }, { status: 400 });
    }

    const referenceNumber = await createUniqueReference(supabase);
    const updatedAt = new Date().toISOString();

    const [updateResult] = await Promise.all([
      supabase
        .from("appointments")
        .update({
          status: "approved",
          qr_token: referenceNumber,
          qr_used_at: null,
          scanned_at: null,
          updated_at: updatedAt,
        })
        .eq("id", appointment.id),
      mirrorAppointmentToCpanel(
        fromAppointmentRow(appointment, {
          status: "approved",
          qr_token: referenceNumber,
          qr_used_at: null,
          scanned_at: null,
          updated_at: updatedAt,
        })
      ),
    ]);
    const { error: updateError } = updateResult;

    if (updateError) {
      console.error("Error updating appointment:", updateError);
      return NextResponse.json({ message: "Failed to update appointment" }, { status: 500 });
    }

    // All slow work (approval email, Google Calendar) runs after the response is sent so
    // the admin gets an immediate reply, but `after()` keeps the Vercel function
    // alive until it completes (unlike fire-and-forget, which Vercel may kill).
    // Email/calendar failures never affect approval.
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
    console.error("Unexpected error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
