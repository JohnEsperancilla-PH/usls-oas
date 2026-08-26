import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, requireSuperAdmin, logAudit } from "@/lib/rbac";
import QRCode from "qrcode";
import crypto from "crypto";
import { sendMail, generateApprovalEmail } from "@/lib/email";

interface ApproveRequest {
  appointmentId: string;
}

function generateQRToken(appointmentId: string): string {
  const secret = process.env.QR_SECRET || "default-secret-key";
  const payload = JSON.stringify({
    appointmentId,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString("hex"),
  });
  
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const signature = hmac.digest("hex");
  
  return Buffer.from(JSON.stringify({ payload, signature })).toString("base64");
}

export async function POST(request: Request) {
  try {
    const { admin, error: authError, status: authStatus } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: authError }, { status: authStatus });

    const check = requireSuperAdmin(admin);
    if (!check.ok) return NextResponse.json({ message: check.error }, { status: check.status });

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

    if (appointment.status !== "pending") {
      return NextResponse.json({ message: "Appointment is not in pending status" }, { status: 400 });
    }

    const qrToken = generateQRToken(appointment.id);

    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        status: "approved",
        qr_token: qrToken,
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

    const emailHtml = generateApprovalEmail(
      appointment.full_name,
      appointment.date,
      appointment.time_slot,
      appointment.offices?.name || "Unknown Office"
    );

    const emailResult = await sendMail({
      to: appointment.email,
      subject: "Appointment Approved - USLS OAS",
      html: emailHtml,
      attachments: [{
        filename: "qrcode.png",
        content: qrBuffer,
        contentType: "image/png",
        cid: "qrcode",
      }],
    });

    if (!emailResult.success) {
      console.error("Approval email failed:", emailResult.error);
    }

    await supabase.from("email_logs").insert({
      appointment_id: appointment.id,
      type: "approval",
      status: emailResult.success ? "sent" : "failed",
      sent_at: emailResult.success ? new Date().toISOString() : null,
      error_message: emailResult.success ? null : emailResult.error || "Failed to send approval email",
    });

    await logAudit(admin.id, admin.email, "approve", {
      appointment_id: appointment.id,
      meta: { visitor_name: appointment.full_name, visitor_email: appointment.email, email_sent: emailResult.success, email_error: emailResult.error || null },
    });

    return NextResponse.json({
      message: "Appointment approved successfully",
      emailSent: emailResult.success,
      emailError: emailResult.success ? null : emailResult.error,
      appointment: { id: appointment.id, status: "approved" },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
