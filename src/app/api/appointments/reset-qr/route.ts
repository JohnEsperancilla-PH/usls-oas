import { NextResponse, after } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin } from "@/lib/rbac";
import { createUniqueReference } from "@/lib/reference";
import { sendMail, generateApprovalEmail, isNotificationEnabled } from "@/lib/email";
import { mirrorAppointmentToCpanel, fromAppointmentRow } from "@/lib/cpanel-mirror";
import type { AppointmentWithOffice } from "@/lib/appointment-actions";

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
      return NextResponse.json({ message: "You can only re-issue reference numbers for appointments in your office" }, { status: 403 });
    }

    if (appointment.status !== "completed") {
      return NextResponse.json({ message: "Only completed appointments can be reset" }, { status: 400 });
    }

    const newReference = await createUniqueReference(supabase);
    const updatedAt = new Date().toISOString();

    const [updateResult] = await Promise.all([
      supabase
        .from("appointments")
        .update({
          status: "approved",
          qr_token: newReference,
          qr_used_at: null,
          scanned_at: null,
          updated_at: updatedAt,
        })
        .eq("id", appointment.id),
      mirrorAppointmentToCpanel(
        fromAppointmentRow(appointment, {
          status: "approved",
          qr_token: newReference,
          qr_used_at: null,
          scanned_at: null,
          updated_at: updatedAt,
        })
      ),
    ]);
    const { error: updateError } = updateResult;

    if (updateError) {
      console.error(updateError);
      return NextResponse.json({ message: "Failed to reset reference number" }, { status: 500 });
    }

    // Re-issue email runs post-response via `after()`.
    after(async () => {
      await runPostResetTasks(appointment, newReference, admin.id, admin.email);
    });

    return NextResponse.json({
      message: "Reference number reset successfully",
      emailSent: null,
      emailPending: true,
      appointment: { id: appointment.id, status: "approved" },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function runPostResetTasks(
  appointment: AppointmentWithOffice,
  referenceNumber: string,
  adminId: string,
  adminEmail: string
) {
  let mailResult: { success: boolean; error?: string | null } = { success: false, error: "Notifications disabled" };

  try {
    const emailResult = await generateApprovalEmail(
      appointment.full_name,
      appointment.date,
      appointment.time_slot,
      appointment.offices?.name || "Unknown Office",
      appointment.valid_id || "",
      referenceNumber,
      appointment.offices?.contact_email,
      appointment.offices?.contact_phone
    );

    if (await isNotificationEnabled("qr_resend")) {
      mailResult = await sendMail({
        to: appointment.email,
        subject: "Appointment Re-approved — USLS OAS",
        html: emailResult.html,
        attachments: emailResult.attachments,
      });
    }

    if (!mailResult.success) {
      console.error(mailResult.error);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("approval email generation", msg);
    mailResult = { success: false, error: msg };
  }

  const supabase = createServiceClient();

  await supabase.from("email_logs").insert({
    appointment_id: appointment.id,
    type: "qr_resend",
    status: mailResult.success ? "sent" : "failed",
    sent_at: mailResult.success ? new Date().toISOString() : null,
    error_message: mailResult.success ? null : "Failed to send reference re-issue email",
  });

  const { logAudit } = await import("@/lib/rbac");
  await logAudit(adminId, adminEmail, "reset_qr", {
    appointment_id: appointment.id,
    meta: { visitor_name: appointment.full_name, visitor_email: appointment.email, action: "reset_qr", email_sent: mailResult.success },
  });
}
