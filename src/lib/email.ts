import nodemailer from "nodemailer";
import { readFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";
import { createServiceClient } from "@/lib/supabase/server";

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function sanitizeError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  return msg
    .replace(/password[^,]*/gi, "password [redacted]")
    .replace(/key[^,]*/gi, "key [redacted]")
    .replace(/token[^,]*/gi, "token [redacted]")
    .replace(/secret[^,]*/gi, "secret [redacted]")
    .replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, "[ip]")
    .replace(/supabase\.co[^\s]*/gi, "[supabase-url]");
}

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

export async function isNotificationEnabled(type: string): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", `notify_${type}`)
      .single();
    return data?.value !== "false";
  } catch {
    return true;
  }
}

let logoPngCache: Buffer | null = null;

async function getLogoAttachment() {
  if (!logoPngCache) {
    const logoPath = join(process.cwd(), "public", "usls-oas-white.png");
    const png = readFileSync(logoPath);
    logoPngCache = await sharp(png).resize(600).png().toBuffer();
  }
  return {
    filename: "oas-logo.png",
    content: logoPngCache,
    cid: "logo",
    contentType: "image/png",
  };
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

interface WrapResult {
  html: string;
  attachments: SendMailAttachments[];
}

async function wrap(title: string, body: string, extraAttachments: SendMailAttachments[] = []): Promise<WrapResult> {
  const logo = await getLogoAttachment();
  return {
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
  <div style="background:#006633;padding:36px 24px;text-align:center;">
    <img src="cid:logo" alt="USLS OAS" style="width:180px;height:auto;display:block;margin:0 auto;" />
  </div>
  <div style="padding:32px 28px;color:#333;line-height:1.6;font-size:15px;">
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111;">${title}</h2>
    <div style="width:40px;height:3px;background:#006633;border-radius:2px;margin-bottom:24px;"></div>
    ${body}
  </div>
  <div style="padding:18px 28px;text-align:center;color:#999;font-size:11px;border-top:1px solid #eee;background:#fafafa;">
    &copy; ${new Date().getFullYear()} OAS &mdash; Online Appointment System<br/>
    <a href="https://www.usls.edu.ph/cmc" style="color:#006633;text-decoration:none;">Center for Marketing and Communications</a><br/>
    <a href="https://www.usls.edu.ph" style="color:#006633;text-decoration:none;">University of St. La Salle</a>
  </div>
</div>
</body></html>`,
    attachments: [logo, ...extraAttachments],
  };
}

function detailRow(label: string, value: string) {
  return `<tr>
    <td style="padding:12px 16px;color:#666;font-size:13px;border-bottom:1px solid #f3f4f6;">${escapeHtml(label)}</td>
    <td style="padding:12px 16px;font-weight:600;text-align:right;font-size:13px;border-bottom:1px solid #f3f4f6;">${escapeHtml(value)}</td>
  </tr>`;
}

function statusBadge(status: string, color: string) {
  return `<span style="display:inline-block;background:${color}15;color:${color};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;text-transform:capitalize;">${status}</span>`;
}

export async function generateBookingConfirmationEmail(name: string, date: string, time: string, office: string, contactEmail?: string | null, contactPhone?: string | null) {
  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const contactLines: string[] = [];
  if (contactEmail) contactLines.push(`<strong>Email:</strong> ${escapeHtml(contactEmail)}`);
  if (contactPhone) contactLines.push(`<strong>Phone:</strong> ${escapeHtml(contactPhone)}`);
  const contactBlock = contactLines.length > 0
    ? `<div style="margin-top:20px;padding:12px 16px;background:#f0f7ff;border-radius:8px;border:1px solid #d0e3f7;font-size:13px;color:#555;line-height:1.8;">For follow-up questions, contact the office:<br/>${contactLines.join("<br/>")}</div>`
    : `<p style="color:#999;font-size:13px;margin:0;">If you have questions, contact the office directly.</p>`;
  const result = await wrap("Appointment Submitted", `
    <p style="color:#555;margin:0 0 20px;">Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p style="color:#555;margin:0 0 24px;">Your appointment request has been received and is pending review. You will be notified once it has been reviewed.</p>
    <table style="width:100%;margin:0 0 24px;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;">
      <tr><td colspan="2" style="padding:12px 16px 8px;font-size:11px;font-weight:600;color:#006633;text-transform:uppercase;letter-spacing:0.5px;">Appointment Details</td></tr>
      ${detailRow("Office", office)}
      ${detailRow("Date", formattedDate)}
      ${detailRow("Time", time)}
      <tr><td style="padding:12px 16px;color:#666;font-size:13px;">Status</td><td style="padding:12px 16px;text-align:right;">${statusBadge("Pending", "#b45309")}</td></tr>
    </table>
    ${contactBlock}
  `);
  return { html: result.html, attachments: result.attachments };
}

export async function generateAdminAlertEmail(name: string, date: string, time: string, office: string, _appointmentId: string, baseUrl?: string) {
  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const dashboardUrl = `${baseUrl || process.env.NEXT_PUBLIC_APP_URL || "https://usls-oas.vercel.app"}/admin`;
  const result = await wrap("New Appointment Request", `
    <p style="color:#555;margin:0 0 20px;">A new appointment has been submitted and requires your review.</p>
    <table style="width:100%;margin:0 0 24px;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;">
      <tr><td colspan="2" style="padding:12px 16px 8px;font-size:11px;font-weight:600;color:#006633;text-transform:uppercase;letter-spacing:0.5px;">Visitor Information</td></tr>
      ${detailRow("Name", name)}
      ${detailRow("Office", office)}
      ${detailRow("Date", formattedDate)}
      ${detailRow("Time", time)}
    </table>
    <div style="text-align:center;margin:28px 0 12px;">
      <a href="${dashboardUrl}" style="display:inline-block;background:#006633;color:#fff;padding:13px 32px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Review Appointment</a>
    </div>
    <p style="color:#999;font-size:12px;margin:0;">You are receiving this because you are an administrator for this office.</p>
  `);
  return { html: result.html, attachments: result.attachments };
}

export async function generateApprovalEmail(name: string, date: string, time: string, office: string, extraAttachments: SendMailAttachments[] = []) {
  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const result = await wrap("Appointment Approved", `
    <p style="color:#555;margin:0 0 20px;">Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p style="color:#555;margin:0 0 24px;">Great news! Your appointment has been approved. Please present the QR code below at the gate for entry.</p>
    <table style="width:100%;margin:0 0 20px;border-collapse:collapse;background:#f0fdf4;border-radius:8px;overflow:hidden;">
      <tr><td colspan="2" style="padding:12px 16px 8px;font-size:11px;font-weight:600;color:#006633;text-transform:uppercase;letter-spacing:0.5px;">Appointment Details</td></tr>
      ${detailRow("Office", office)}
      ${detailRow("Date", formattedDate)}
      ${detailRow("Time", time)}
      <tr><td style="padding:12px 16px;color:#666;font-size:13px;">Status</td><td style="padding:12px 16px;text-align:right;">${statusBadge("Approved", "#006633")}</td></tr>
    </table>
    <div style="text-align:center;margin:24px 0;padding:24px;background:#f9fafb;border-radius:12px;border:1px dashed #d1d5db;">
      <p style="margin:0 0 12px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Your Entry QR Code</p>
      <img src="cid:qrcode" alt="QR Code" style="width:240px;border:2px solid #006633;border-radius:8px;padding:6px;background:#fff;" />
    </div>
    <p style="color:#999;font-size:12px;margin:0;text-align:center;">This QR code is single-use and will be invalidated after scanning.</p>
  `, extraAttachments);
  return { html: result.html, attachments: result.attachments };
}

export async function generateDeclineEmail(name: string, date: string, time: string, office: string, reason?: string, contactEmail?: string | null, contactPhone?: string | null) {
  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const contactLines: string[] = [];
  if (contactEmail) contactLines.push(`<strong>Email:</strong> ${escapeHtml(contactEmail)}`);
  if (contactPhone) contactLines.push(`<strong>Phone:</strong> ${escapeHtml(contactPhone)}`);
  const contactBlock = contactLines.length > 0
    ? `<div style="margin-top:20px;padding:12px 16px;background:#fef2f2;border-radius:8px;border:1px solid #fecaca;font-size:13px;color:#555;line-height:1.8;">If you believe this was an error, contact the office:<br/>${contactLines.join("<br/>")}</div>`
    : `<p style="color:#999;font-size:13px;margin:0;">If you believe this was an error, please contact the office directly.</p>`;
  const result = await wrap("Appointment Declined", `
    <p style="color:#555;margin:0 0 20px;">Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p style="color:#555;margin:0 0 24px;">We regret to inform you that your appointment has been declined.</p>
    <table style="width:100%;margin:0 0 20px;border-collapse:collapse;background:#fef2f2;border-radius:8px;overflow:hidden;">
      <tr><td colspan="2" style="padding:12px 16px 8px;font-size:11px;font-weight:600;color:#dc2626;text-transform:uppercase;letter-spacing:0.5px;">Appointment Details</td></tr>
      ${detailRow("Office", office)}
      ${detailRow("Date", formattedDate)}
      ${detailRow("Time", time)}
      <tr><td style="padding:12px 16px;color:#666;font-size:13px;">Status</td><td style="padding:12px 16px;text-align:right;">${statusBadge("Declined", "#dc2626")}</td></tr>
      ${reason ? detailRow("Reason", reason) : ""}
    </table>
    <p style="color:#555;margin:0 0 8px;">You may submit a new appointment request at any time if you would like to try again.</p>
    ${contactBlock}
  `);
  return { html: result.html, attachments: result.attachments };
}
