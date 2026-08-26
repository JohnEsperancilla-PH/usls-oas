import { NextResponse } from "next/server";
import { sendMail } from "@/lib/email";
import QRCode from "qrcode";

export async function POST(request: Request) {
  try {
    const { to } = await request.json();

    if (!to) {
      return NextResponse.json({ message: "Recipient email is required" }, { status: 400 });
    }

    // Generate a sample QR code
    const qrToken = "SAMPLE-QR-TOKEN-12345-TEST";
    const qrCodeDataUrl = await QRCode.toDataURL(qrToken, {
      width: 300,
      margin: 2,
      color: {
        dark: "#006633",
        light: "#ffffff",
      },
    });

    // Convert to buffer for inline attachment
    const qrBase64 = qrCodeDataUrl.split(",")[1];
    const qrBuffer = Buffer.from(qrBase64, "base64");

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #006633; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">USLS Online Appointment System</h1>
        </div>
        <div style="background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd;">
          <h2>Appointment Approved</h2>
          <p>Dear Juan Dela Cruz,</p>
          <p>Great news! Your appointment has been approved.</p>
          <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Date:</strong> ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
            <p><strong>Time:</strong> 9:00 AM</p>
            <p><strong>Office:</strong> Registrar</p>
            <p><strong>Status:</strong> <span style="color: #006633;">Approved</span></p>
          </div>
          <p>Please present the QR code below at the gate for verification:</p>
          <div style="text-align: center; margin: 20px 0;">
            <img src="cid:qrcode" alt="QR Code" style="max-width: 200px; border: 2px solid #006633; padding: 10px; background: white;">
          </div>
          <p><strong>Important:</strong> This QR code is single-use and will be invalidated after scanning at the gate.</p>
        </div>
        <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </body>
      </html>
    `;

    const result = await sendMail({
      to,
      subject: "Appointment Approved - USLS OAS",
      html,
      attachments: [
        {
          filename: "qrcode.png",
          content: qrBuffer,
          cid: "qrcode",
          contentType: "image/png",
        },
      ],
    });

    if (result.success) {
      return NextResponse.json({ message: "QR code email sent successfully", messageId: result.messageId });
    } else {
      return NextResponse.json({ message: "Failed to send email", error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error("QR email test error:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}