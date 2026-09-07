import { NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin } from "@/lib/rbac";
import { runPostDeclineTasks } from "@/lib/appointment-actions";
import { mirrorAppointmentToCpanel, fromAppointmentRow } from "@/lib/cpanel-mirror";

interface DeclineRequest {
  appointmentId: string;
  reason?: string;
}

export async function POST(request: Request) {
  try {
    const { admin, error: authError, status: authStatus } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: authError }, { status: authStatus });

    const body: DeclineRequest = await request.json();

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
      return NextResponse.json({ message: "You can only decline appointments for your office" }, { status: 403 });
    }

    if (appointment.status !== "pending") {
      return NextResponse.json({ message: "Appointment is not in pending status" }, { status: 400 });
    }

    const updatedAt = new Date().toISOString();

    const [updateResult] = await Promise.all([
      supabase
        .from("appointments")
        .update({
          status: "declined",
          decline_reason: body.reason || null,
          updated_at: updatedAt,
        })
        .eq("id", appointment.id),
      mirrorAppointmentToCpanel(
        fromAppointmentRow(appointment, {
          status: "declined",
          decline_reason: body.reason || null,
          updated_at: updatedAt,
        })
      ),
    ]);
    const { error: updateError } = updateResult;

    if (updateError) {
      return NextResponse.json({ message: "Failed to update appointment" }, { status: 500 });
    }

    // The decline email runs after the response is sent (kept alive via `after()`),
    // so the admin gets an immediate response.
    after(async () => {
      await runPostDeclineTasks(appointment, body.reason, admin.id, admin.email);
    });

    return NextResponse.json({
      message: "Appointment declined successfully",
      emailSent: null,
      emailPending: true,
      appointment: { id: appointment.id, status: "declined" },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
