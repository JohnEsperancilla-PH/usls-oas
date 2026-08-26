import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { sendMail, generateApprovalEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const { to } = await request.json();

    if (!to) {
      return NextResponse.json({ message: "Recipient email is required" }, { status: 400 });
    }

    const qrDataUrl = await QRCode.toDataURL("TEST-QR-12345", {
      width: 300,
      margin: 2,
      color: { dark: "#006633", light: "#ffffff" },
    });
    const qrBuffer = Buffer.from(qrDataUrl.split(",")[1], "base64");

    const html = generateApprovalEmail(
      "Juan Dela Cruz",
      "August 30, 2026",
      "10:00 AM - 11:00 AM",
      "Registrar"
    );

    const result = await sendMail({
      to,
      subject: "USLS OAS - Sample Approval Email",
      html,
      attachments: [{ filename: "qrcode.png", content: qrBuffer, cid: "<qrcode>", contentType: "image/png" }],
    });

    if (result.success) {
      return NextResponse.json({ message: "Test email sent successfully", messageId: result.messageId });
    } else {
      return NextResponse.json({ message: "Failed to send email", error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error("Email test error:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}