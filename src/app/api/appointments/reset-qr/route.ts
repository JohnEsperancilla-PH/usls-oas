import { NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin } from "@/lib/rbac";
import { generateQRToken } from "@/lib/qr";
import QRCode from "qrcode";
import { sendMail, generateApprovalEmail, isNotificationEnabled } from "@/lib/email";

interface ResetRequest {
  appointmentId: string;
}

export async function POST(request: Request) {
  try {
    const { admin, error: authError, status: authStatus } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: authError }, { status: authStatus });

    const body: ResetRequest = await request.json();

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
      return NextResponse.json({ message: "You can only reset QR for appointments in your office" }, { status: 403 });
    }

    if (appointment.status !== "completed") {
      return NextResponse.json({ message: "Only completed appointments can be reset" }, { status: 400 });
    }

    const newToken = generateQRToken(appointment.id);

    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        status: "approved",
        qr_token: newToken,
        qr_used_at: null,
        scanned_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appointment.id);

    if (updateError) {
      console.error("Error resetting appointment:", updateError);
      return NextResponse.json({ message: "Failed to reset appointment" }, { status: 500 });
    }

    // QR email runs after the response is sent (kept alive via `after()`),
    // so the admin gets an immediate response.
    after(async () => {
      await runPostResetTasks(appointment, newToken, admin.id, admin.email);
    });

    return NextResponse.json({
      message: "QR code reset successfully",
      emailSent: null,
      emailPending: true,
      appointment: { id: appointment.id, status: "approved" },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

async function runPostResetTasks(
  appointment: any,
  qrToken: string,
  adminId: string,
  adminEmail: string
) {
  let mailResult: { success: boolean; error?: string | null } = { success: false, error: "Notifications disabled" };

  try {
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

    if (await isNotificationEnabled("qr_resend")) {
      mailResult = await sendMail({
        to: appointment.email,
        subject: "Appointment Re-approved — USLS OAS",
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
      console.error("QR re-send email failed:", mailResult.error);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("QR re-send email generation failed:", msg);
    mailResult = { success: false, error: msg };
  }

  const supabase = createServiceClient();

  await supabase.from("email_logs").insert({
    appointment_id: appointment.id,
    type: "qr_resend",
    status: mailResult.success ? "sent" : "failed",
    sent_at: mailResult.success ? new Date().toISOString() : null,
    error_message: mailResult.success ? null : "Failed to send QR re-send email",
  });

  const { logAudit } = await import("@/lib/rbac");
  await logAudit(adminId, adminEmail, "reset_qr", {
    appointment_id: appointment.id,
    meta: { visitor_name: appointment.full_name, visitor_email: appointment.email, action: "reset_qr", email_sent: mailResult.success },
  });
}
