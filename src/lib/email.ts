import nodemailer from "nodemailer";

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

interface SendMailAttachments {
  filename: string;
  content: Buffer | string;
  cid: string;
  contentType?: string;
}

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: SendMailAttachments[];
}

export async function sendMail({ to, subject, html, attachments }: SendMailOptions) {
  const maxRetries = 3;
  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxRetries) {
    try {
      const info = await getTransporter().sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject,
        html,
        attachments,
      });

      console.log("Email sent:", info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      attempt++;
      lastError = error;
      console.error(`Email attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
  return { success: false, error: errorMessage };
}

function wrap(title: string, body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<div style="max-width:520px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;">
<div style="background:#006633;padding:20px;text-align:center;">
<strong style="color:#fff;font-size:16px;">USLS Online Appointment System</strong>
</div>
<div style="padding:28px 32px;color:#333;line-height:1.6;font-size:15px;">
${body}
</div>
<div style="padding:16px 32px;text-align:center;color:#999;font-size:12px;border-top:1px solid #eee;">
This is an automated message. Please do not reply.
</div>
</div></body></html>`;
}

function detailRow(label: string, value: string) {
  return `<tr><td style="padding:6px 0;color:#666;">${label}</td><td style="padding:6px 0;font-weight:600;text-align:right;">${value}</td></tr>`;
}

export function generateBookingConfirmationEmail(name: string, date: string, time: string, office: string) {
  return wrap("Appointment Confirmation", `
    <p>Dear ${name},</p>
    <p>Your appointment request has been submitted and is pending review.</p>
    <table style="width:100%;margin:20px 0;border-collapse:collapse;">
      ${detailRow("Date", date)}
      ${detailRow("Time", time)}
      ${detailRow("Office", office)}
      ${detailRow("Status", '<span style="color:#b45309;">Pending</span>')}
    </table>
    <p>You will be notified once your appointment has been reviewed.</p>
  `);
}

export function generateAdminAlertEmail(name: string, date: string, time: string, office: string, _appointmentId: string) {
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin`;
  return wrap("New Appointment Request", `
    <p>A new appointment has been submitted and requires review.</p>
    <table style="width:100%;margin:20px 0;border-collapse:collapse;">
      ${detailRow("Visitor", name)}
      ${detailRow("Date", date)}
      ${detailRow("Time", time)}
      ${detailRow("Office", office)}
    </table>
    <p style="text-align:center;margin:24px 0;">
      <a href="${dashboardUrl}" style="background:#006633;color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:600;">Review Appointment</a>
    </p>
  `);
}

export function generateApprovalEmail(name: string, date: string, time: string, office: string) {
  return wrap("Appointment Approved", `
    <p>Dear ${name},</p>
    <p>Your appointment has been approved.</p>
    <table style="width:100%;margin:20px 0;border-collapse:collapse;">
      ${detailRow("Date", date)}
      ${detailRow("Time", time)}
      ${detailRow("Office", office)}
      ${detailRow("Status", '<span style="color:#006633;">Approved</span>')}
    </table>
    <p>Present this QR code at the gate for entry:</p>
    <div style="text-align:center;margin:24px 0;">
      <img src="cid:<qrcode>" alt="QR Code" style="width:180px;border:2px solid #006633;border-radius:8px;padding:8px;background:#fff;">
    </div>
    <p style="font-size:13px;color:#666;">This QR code is single-use and will be invalidated after scanning.</p>
  `);
}

export function generateDeclineEmail(name: string, date: string, time: string, office: string, reason?: string) {
  return wrap("Appointment Declined", `
    <p>Dear ${name},</p>
    <p>Your appointment has been declined.</p>
    <table style="width:100%;margin:20px 0;border-collapse:collapse;">
      ${detailRow("Date", date)}
      ${detailRow("Time", time)}
      ${detailRow("Office", office)}
      ${detailRow("Status", '<span style="color:#dc2626;">Declined</span>')}
      ${reason ? detailRow("Reason", reason) : ""}
    </table>
    <p>You may submit a new appointment request if needed.</p>
  `);
}