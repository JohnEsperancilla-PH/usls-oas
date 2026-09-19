import { NextResponse, after } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin } from "@/lib/rbac";
import { runPostDeclineTasks, runPostponementTasks } from "@/lib/appointment-actions";
import { mirrorAppointmentToCpanel, fromAppointmentRow } from "@/lib/cpanel-mirror";
import { getManilaToday } from "@/lib/time";

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
      return NextResponse.json({ message: "You can only decline appointments for your office" }, { status: 403 });
    }

    if (appointment.status !== "pending" && appointment.status !== "postponed") {
      return NextResponse.json({ message: "Appointment is not in pending or postponed status" }, { status: 400 });
    }

    const postpone = body.postpone;
    if (postpone !== undefined && postpone !== null) {
      if (typeof postpone !== "object" || !postpone.date || !postpone.timeSlot) {
        return NextResponse.json({ message: "Postponement requires a new date and time slot" }, { status: 400 });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(postpone.date)) {
        return NextResponse.json({ message: "Invalid date format" }, { status: 400 });
      }
      if (!/^\d{2}:(00|30)$/.test(postpone.timeSlot)) {
        return NextResponse.json({ message: "Invalid time slot format" }, { status: 400 });
      }
      if (postpone.date < getManilaToday()) {
        return NextResponse.json({ message: "Cannot postpone to a past date" }, { status: 400 });
      }

      const postponedAt = new Date().toISOString();

      const { error: postponeError, data: postponed } = await supabase
        .from("appointments")
        .update({
          status: "postponed",
          date: postpone.date,
          time_slot: postpone.timeSlot,
          decline_reason: body.reason || null,
          updated_at: postponedAt,
        })
        .eq("id", appointment.id)
        .in("status", ["pending", "postponed"])
        .select("id")
        .maybeSingle();

      if (postponeError) {
        console.error(postponeError);
        return NextResponse.json({ message: "Failed to update appointment" }, { status: 500 });
      }

      if (!postponed) {
        return NextResponse.json({ message: "This appointment was already reviewed. Refresh to see its current status." }, { status: 409 });
      }

      await mirrorAppointmentToCpanel(
        fromAppointmentRow(appointment, {
          status: "postponed",
          date: postpone.date,
          time_slot: postpone.timeSlot,
          decline_reason: body.reason || null,
          updated_at: postponedAt,
        })
      );

      // Postponement email runs post-response via `after()`.
      after(async () => {
        await runPostponementTasks(appointment, postpone.date, postpone.timeSlot, body.reason, admin.id, admin.email);
      });

      return NextResponse.json({
        message: "Appointment postponed successfully",
        emailSent: null,
        emailPending: true,
        appointment: { id: appointment.id, status: "postponed" },
      });
    }

    const updatedAt = new Date().toISOString();

    const { error: updateError, data: updated } = await supabase
      .from("appointments")
      .update({
        status: "declined",
        decline_reason: body.reason || null,
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
        status: "declined",
        decline_reason: body.reason || null,
        updated_at: updatedAt,
      })
    );

    // Decline email runs post-response via `after()`.
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
    return handleRouteError(error);
  }
}
