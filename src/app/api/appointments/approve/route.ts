import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, logAudit } from "@/lib/rbac";
import { generateQRToken } from "@/lib/qr";
import QRCode from "qrcode";
import { sendMail, generateApprovalEmail, isNotificationEnabled } from "@/lib/email";
import { createCalendarEvent } from "@/lib/calendar";

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

    const qrToken = generateQRToken(appointment.id);

    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        status: "approved",
        qr_token: qrToken,
        qr_used_at: null,
        scanned_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appointment.id);

    if (updateError) {
      console.error("Error updating appointment:", updateError);
      return NextResponse.json({ message: "Failed to update appointment" }, { status: 500 });
    }

    const qrCodeDataUrl = await QRCode.toDataURL(qrToken, {
      width: 300,
      margin: 2,
      color: { dark: "#006633", light: "#ffffff" },
    });

    const qrBase64 = qrCodeDataUrl.split(",")[1];
    const qrBuffer = Buffer.from(qrBase64, "base64");

    const emailResult = await generateApprovalEmail(
      appointment.full_name,
      appointment.date,
      appointment.time_slot,
      appointment.offices?.name || "Unknown Office"
    );

    let mailResult: { success: boolean; error?: string | null; messageId?: string } = { success: false, error: "Notifications disabled" };
    if (await isNotificationEnabled("approval")) {
      mailResult = await sendMail({
        to: appointment.email,
        subject: "Appointment Approved - USLS OAS",
        html: emailResult.html,
        attachments: [...emailResult.attachments, {
          filename: "qrcode.png",
          content: qrBuffer,
          contentType: "image/png",
          cid: "qrcode",
        }],
      });
    }

    if (!mailResult.success) {
      console.error("Approval email failed:", mailResult.error);
    }

    await supabase.from("email_logs").insert({
      appointment_id: appointment.id,
      type: "approval",
      status: mailResult.success ? "sent" : "failed",
      sent_at: mailResult.success ? new Date().toISOString() : null,
      error_message: mailResult.success ? null : "Failed to send approval email",
    });

    // Create the Google Calendar event (non-blocking — approval succeeds even if it fails)
    let calendarResult: { id?: string; htmlLink?: string | null; error?: string; skipped: boolean } = { skipped: true };
    const startedAt = Date.now();
    try {
      const start = new Date(`${appointment.date}T${appointment.time_slot}:00`);
      const end = new Date(start.getTime() + (appointment.duration || 30) * 60 * 1000);
      const officeName = appointment.offices?.name || "Unknown Office";
      const attendees = [appointment.email];
      if (appointment.offices?.email) attendees.push(appointment.offices.email);
      const event = await createCalendarEvent({
        title: `Appointment - ${appointment.full_name} (${officeName})`,
        description: appointment.purpose_of_visit || "No purpose of visit provided.",
        start,
        end,
        attendees,
      });
      calendarResult = { id: event.id, htmlLink: event.htmlLink, skipped: false };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Google Calendar event creation failed:", msg);
      calendarResult = { error: msg, skipped: false };
    }

    await logAudit(admin.id, admin.email, "approve", {
      appointment_id: appointment.id,
      meta: {
        visitor_name: appointment.full_name,
        visitor_email: appointment.email,
        email_sent: mailResult.success,
        calendar_event_created: calendarResult.skipped ? null : !calendarResult.error,
        calendar_event_id: calendarResult.id,
        calendar_duration_ms: Date.now() - startedAt,
        calendar_error: calendarResult.error || null,
      },
    });

    return NextResponse.json({
      message: "Appointment approved successfully",
      emailSent: mailResult.success,
      emailError: mailResult.success ? null : "Email delivery failed",
      calendarEvent: calendarResult.skipped
        ? null
        : { id: calendarResult.id, htmlLink: calendarResult.htmlLink, error: calendarResult.error || null },
      appointment: { id: appointment.id, status: "approved" },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
