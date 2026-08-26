import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, logAudit } from "@/lib/rbac";
import QRCode from "qrcode";
import crypto from "crypto";
import { sendMail, generateApprovalEmail } from "@/lib/email";

interface ResetRequest {
  appointmentId: string;
}

function generateQRToken(appointmentId: string): string {
  const secret = process.env.QR_SECRET || "default-secret-key";
  const payload = JSON.stringify({
    appointmentId,
    timestamp: Date.now(),
    nonce: crypto.randomUUID(),
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

    const qrCodeDataUrl = await QRCode.toDataURL(newToken, {
      width: 300,
      margin: 2,
      color: { dark: "#006633", light: "#ffffff" },
    });

    const qrBase64 = qrCodeDataUrl.split(",")[1];
    const qrBuffer = Buffer.from(qrBase64, "base64");

    const emailResult = generateApprovalEmail(
      appointment.full_name,
      appointment.date,
      appointment.time_slot,
      appointment.offices?.name || "Unknown Office"
    );

    const mailResult = await sendMail({
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

    await logAudit(admin.id, admin.email, "approve", {
      appointment_id: appointment.id,
      meta: { visitor_name: appointment.full_name, visitor_email: appointment.email, action: "reset_qr", email_sent: mailResult.success },
    });

    return NextResponse.json({
      message: "QR code reset successfully",
      emailSent: mailResult.success,
      appointment: { id: appointment.id, status: "approved" },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
