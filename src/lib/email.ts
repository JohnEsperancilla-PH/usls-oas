import nodemailer from "nodemailer";
import { readFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";
import { createServiceClient } from "@/lib/supabase/server";
import { formatTimeSlot } from "@/lib/time";

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export { sanitizeError } from "@/lib/http";

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
  cid?: string;
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
    <img src="cid:logo" alt="USLS OASYS" style="width:180px;height:auto;display:block;margin:0 auto;" />
  </div>
  <div style="padding:32px 28px;color:#333;line-height:1.6;font-size:15px;">
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111;">${title}</h2>
    <div style="width:40px;height:3px;background:#006633;border-radius:2px;margin-bottom:24px;"></div>
    ${body}
  </div>
  <div style="padding:18px 28px;text-align:center;color:#999;font-size:11px;border-top:1px solid #eee;background:#fafafa;">
    &copy; ${new Date().getFullYear()} OASYS &mdash; Online Appointment System<br/>
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

export interface EmailVisitor {
  fullName: string;
  validId: string;
  isBooker?: boolean;
}

function visitorDetails(visitors: EmailVisitor[] = []) {
  if (visitors.length <= 1) return "";
  return `<div style="margin:0 0 20px;padding:16px;background:#fff7ed;border-radius:8px;border:1px solid #fed7aa;font-size:13px;color:#555;line-height:1.8;">
    <strong style="color:#9a3412;">Group entry note</strong><br/>
    All ${visitors.length} visitors must enter together. The booking person will receive and present the single gate entry code.<br/>
    ${visitors.map((visitor, index) => `${index + 1}. <strong>${escapeHtml(visitor.fullName)}</strong> &mdash; ${escapeHtml(visitor.validId)}`).join("<br/>")}
  </div>`;
}

function bulletList(items: string[]) {
  return `<ul style="margin:0 0 24px;padding-left:18px;color:#555;font-size:14px;line-height:1.8;">
    ${items.map((item) => `<li style="margin-bottom:4px;">${item}</li>`).join("")}
  </ul>`;
}

function gateNotes(validId: string) {
  return bulletList([
    `Present this ticket or your reference number at <strong>USLS Gate 2</strong> on your appointment date.`,
    `Bring the <strong>${escapeHtml(validId)}</strong> you listed &mdash; the Guard will issue your visitor&apos;s pass.`,
    `Please arrive at Gate 2 by <strong>20 minutes</strong> before your scheduled time.`,
    `Entry is allowed only from 30 minutes before the scheduled time; arriving <strong>15 minutes</strong> after voids the gate entry code.`,
  ]);
}

export async function generateBookingConfirmationEmail(name: string, date: string, time: string, office: string, validId: string, contactEmail?: string | null, contactPhone?: string | null, visitors?: EmailVisitor[]) {
  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const contactLines: string[] = [];
  if (contactEmail) contactLines.push(`<strong>Email:</strong> ${escapeHtml(contactEmail)}`);
  if (contactPhone) contactLines.push(`<strong>Phone:</strong> ${escapeHtml(contactPhone)}`);
  const contactBlock = contactLines.length > 0
    ? `<div style="margin-top:20px;padding:12px 16px;background:#f0f7ff;border-radius:8px;border:1px solid #d0e3f7;font-size:13px;color:#555;line-height:1.8;">For follow-up questions, contact the office:<br/>${contactLines.join("<br/>")}</div>`
    : `<p style="color:#999;font-size:13px;margin:0;">If you have questions, contact the office directly.</p>`;
  const result = await wrap("Appointment Submitted", `
    <p style="color:#555;margin:0 0 20px;">Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p style="color:#555;margin:0 0 24px;">Your appointment has been received and is pending review.</p>
    ${gateNotes(validId)}
    <table style="width:100%;margin:0 0 24px;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;">
      <tr><td colspan="2" style="padding:12px 16px 8px;font-size:11px;font-weight:600;color:#006633;text-transform:uppercase;letter-spacing:0.5px;">Appointment Details</td></tr>
      ${detailRow("Office", office)}
      ${detailRow("Date", formattedDate)}
      ${detailRow("Time", formatTimeSlot(time))}
      <tr><td style="padding:12px 16px;color:#666;font-size:13px;">Status</td><td style="padding:12px 16px;text-align:right;">${statusBadge("Pending", "#b45309")}</td></tr>
    </table>
    ${visitorDetails(visitors)}
    ${contactBlock}
  `);
  return { html: result.html, attachments: result.attachments };
}

export async function generateAdminAlertEmail(
  name: string,
  date: string,
  time: string,
  office: string,
  _appointmentId: string,
  baseUrl?: string,
  actionLinks?: { approveUrl?: string; declineUrl?: string }
  , visitors?: EmailVisitor[]
) {
  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const rootUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL || "https://oasys.usls.edu.ph";
  const dashboardUrl = `${rootUrl}/admin`;

  const actionBlock = actionLinks?.approveUrl && actionLinks?.declineUrl
    ? `
    <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0 0;margin:28px 0 0;">
      <tr>
        <td style="padding:0;">
          <a href="${actionLinks.approveUrl}" style="display:block;background:#006633;color:#ffffff;padding:13px 0;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;text-align:center;">Approve Appointment</a>
        </td>
        <td style="width:12px;padding:0;"></td>
        <td style="padding:0;">
          <a href="${actionLinks.declineUrl}" style="display:block;background:#ffffff;color:#dc2626;padding:12px 0;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;text-align:center;border:1px solid #dc2626;">Deny Appointment</a>
        </td>
      </tr>
    </table>
    <p style="color:#999;font-size:12px;margin:14px 0 0;text-align:center;">Prefer the admin panel? <a href="${dashboardUrl}" style="color:#006633;text-decoration:underline;">Review here instead</a></p>`
    : `
    <div style="text-align:center;margin:28px 0 12px;">
      <a href="${dashboardUrl}" style="display:inline-block;background:#006633;color:#fff;padding:13px 32px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Review Appointment</a>
    </div>`;

  const result = await wrap("New Appointment Request", `
    <p style="color:#555;margin:0 0 20px;">A new appointment has been submitted and is waiting for your review.</p>
    <table style="width:100%;margin:0 0 0;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;">
      <tr><td colspan="2" style="padding:12px 16px 8px;font-size:11px;font-weight:600;color:#006633;text-transform:uppercase;letter-spacing:0.5px;">Visitor Information</td></tr>
      ${detailRow("Name", name)}
      ${detailRow("Office", office)}
      ${detailRow("Date", formattedDate)}
      ${detailRow("Time", formatTimeSlot(time))}
      ${visitors && visitors.length > 1 ? detailRow("Number of Visitors", String(visitors.length)) : ""}
    </table>
    ${visitorDetails(visitors)}
    ${actionBlock}
    <p style="color:#999;font-size:12px;margin:0;">You are receiving this because you are an administrator for this office.</p>
  `);
  return { html: result.html, attachments: result.attachments };
}

export async function generateApprovalEmail(
  name: string,
  date: string,
  time: string,
  office: string,
  validId: string,
  referenceNumber: string,
  contactEmail?: string | null,
  contactPhone?: string | null,
  visitors?: EmailVisitor[]
) {
  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const contactLines: string[] = [];
  if (contactEmail) contactLines.push(`<strong>Email:</strong> ${escapeHtml(contactEmail)}`);
  if (contactPhone) contactLines.push(`<strong>Phone:</strong> ${escapeHtml(contactPhone)}`);
  const contactBlock = contactLines.length > 0
    ? `<div style="margin-top:20px;padding:12px 16px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;font-size:13px;color:#555;line-height:1.8;">If you have questions about your appointment, contact the office:<br/>${contactLines.join("<br/>")}</div>`
    : `<p style="color:#999;font-size:13px;margin:0;">If you have questions, contact the office directly.</p>`;
  const result = await wrap("Appointment Approved", `
    <p style="color:#555;margin:0 0 20px;">Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p style="color:#555;margin:0 0 6px;">Great news! Your appointment has been approved. Please present your reference number below at the gate for entry.</p>
    ${gateNotes(validId)}
    <div style="text-align:center;margin:24px 0;padding:24px;background:#f9fafb;border-radius:12px;border:1px dashed #d1d5db;">
      <p style="margin:0 0 8px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Your Reference Number</p>
      <div style="font-size:34px;font-weight:800;letter-spacing:6px;color:#006633;padding:12px 24px;background:#fff;border:2px solid #006633;border-radius:8px;">${escapeHtml(referenceNumber)}</div>
    </div>
    <p style="color:#999;font-size:12px;margin:0 0 20px;text-align:center;">This reference number is single-use and will be disabled after entry.</p>
    <table style="width:100%;margin:0 0 20px;border-collapse:collapse;background:#f0fdf4;border-radius:8px;overflow:hidden;">
      <tr><td colspan="2" style="padding:12px 16px 8px;font-size:11px;font-weight:600;color:#006633;text-transform:uppercase;letter-spacing:0.5px;">Appointment Details</td></tr>
      ${detailRow("Office", office)}
      ${detailRow("Date", formattedDate)}
      ${detailRow("Time", formatTimeSlot(time))}
      ${detailRow("Valid ID to Present", validId)}
      <tr><td style="padding:12px 16px;color:#666;font-size:13px;">Status</td><td style="padding:12px 16px;text-align:right;">${statusBadge("Approved", "#006633")}</td></tr>
    </table>
    ${visitorDetails(visitors)}
    ${contactBlock}
  `);
  return { html: result.html, attachments: result.attachments };
}

export async function generateDeclineEmail(name: string, date: string, time: string, office: string, reason?: string, contactEmail?: string | null, contactPhone?: string | null, visitors?: EmailVisitor[]) {
  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const rootUrl = process.env.NEXT_PUBLIC_APP_URL || "https://oasys.usls.edu.ph";
  const bookingUrl = `${rootUrl}/`;
  const contactLines: string[] = [];
  if (contactEmail) contactLines.push(`<strong>Email:</strong> ${escapeHtml(contactEmail)}`);
  if (contactPhone) contactLines.push(`<strong>Phone:</strong> ${escapeHtml(contactPhone)}`);
  const officeContact = contactEmail && contactPhone
    ? `${escapeHtml(contactEmail)} and ${escapeHtml(contactPhone)}`
    : contactEmail
      ? escapeHtml(contactEmail)
      : contactPhone
        ? escapeHtml(contactPhone)
        : "the office";
  const contactBlock = contactLines.length > 0
    ? `<div style="margin-top:16px;padding:12px 16px;background:#fef2f2;border-radius:8px;border:1px solid #fecaca;font-size:13px;color:#555;line-height:1.8;">If you believe this was an error, contact the office:<br/>${contactLines.join("<br/>")}</div>`
    : `<p style="color:#999;font-size:13px;margin:14px 0 0;">If you believe this was an error, please contact the office directly.</p>`;
  const result = await wrap("Appointment Declined", `
    <p style="color:#555;margin:0 0 20px;">Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p style="color:#555;margin:0 0 24px;">We regret to inform you that your appointment has been declined.</p>
    ${bulletList([
      reason ? `Reason: <strong>${escapeHtml(reason)}</strong>` : `A reason was not provided — please contact ${officeContact} if you believe this is an error.`,
      `<a href="${bookingUrl}" style="color:#006633;font-weight:600;text-decoration:underline;">Submit a new appointment</a> anytime, or contact ${officeContact}.`,
    ])}
    <table style="width:100%;margin:0 0 20px;border-collapse:collapse;background:#fef2f2;border-radius:8px;overflow:hidden;">
      <tr><td colspan="2" style="padding:12px 16px 8px;font-size:11px;font-weight:600;color:#dc2626;text-transform:uppercase;letter-spacing:0.5px;">Appointment Details</td></tr>
      ${detailRow("Office", office)}
      ${detailRow("Date", formattedDate)}
      ${detailRow("Time", formatTimeSlot(time))}
      <tr><td style="padding:12px 16px;color:#666;font-size:13px;">Status</td><td style="padding:12px 16px;text-align:right;">${statusBadge("Declined", "#dc2626")}</td></tr>
    </table>
    ${visitorDetails(visitors)}
    ${contactBlock}
  `);
  return { html: result.html, attachments: result.attachments };
}

export async function generatePostponementEmail(
  name: string,
  originalDate: string,
  originalTime: string,
  newDate: string,
  newTime: string,
  office: string,
  reason?: string,
  contactEmail?: string | null,
  contactPhone?: string | null,
  visitors?: EmailVisitor[]
) {
  const formattedOriginal = new Date(originalDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const formattedNew = new Date(newDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const contactLines: string[] = [];
  if (contactEmail) contactLines.push(`<strong>Email:</strong> ${escapeHtml(contactEmail)}`);
  if (contactPhone) contactLines.push(`<strong>Phone:</strong> ${escapeHtml(contactPhone)}`);
  const contactBlock = contactLines.length > 0
    ? `<div style="margin-top:16px;padding:12px 16px;background:#fffbeb;border-radius:8px;border:1px solid #fde68a;font-size:13px;color:#555;line-height:1.8;">If you have questions about the new schedule, contact the office:<br/>${contactLines.join("<br/>")}</div>`
    : `<p style="color:#999;font-size:13px;margin:14px 0 0;">If you have questions about the new schedule, please contact the office directly.</p>`;
  const result = await wrap("Appointment Postponed", `
    <p style="color:#555;margin:0 0 20px;">Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p style="color:#555;margin:0 0 6px;">The office has postponed your appointment. Your new schedule is below.</p>
    ${bulletList([
      `New schedule: <strong>${formattedNew}</strong> at <strong>${formatTimeSlot(newTime)}</strong>${reason ? ` &mdash; ${escapeHtml(reason)}` : ""}`,
      `Your reference number for the new schedule will be sent once the office confirms the appointment.`,
    ])}
    <table style="width:100%;margin:0 0 20px;border-collapse:collapse;background:#fff7ed;border-radius:8px;overflow:hidden;">
      <tr><td colspan="2" style="padding:12px 16px 8px;font-size:11px;font-weight:600;color:#b45309;text-transform:uppercase;letter-spacing:0.5px;">Original Schedule</td></tr>
      ${detailRow("Office", office)}
      ${detailRow("Date", formattedOriginal)}
      ${detailRow("Time", formatTimeSlot(originalTime))}
    </table>
    <table style="width:100%;margin:0 0 20px;border-collapse:collapse;background:#f0fdf4;border-radius:8px;overflow:hidden;">
      <tr><td colspan="2" style="padding:12px 16px 8px;font-size:11px;font-weight:600;color:#006633;text-transform:uppercase;letter-spacing:0.5px;">New Schedule</td></tr>
      ${detailRow("Office", office)}
      ${detailRow("Date", formattedNew)}
      ${detailRow("Time", formatTimeSlot(newTime))}
      <tr><td style="padding:12px 16px;color:#666;font-size:13px;">Status</td><td style="padding:12px 16px;text-align:right;">${statusBadge("Postponed", "#b45309")}</td></tr>
    </table>
    ${visitorDetails(visitors)}
    ${contactBlock}
  `);
  return { html: result.html, attachments: result.attachments };
}

export async function generateInvitationEmail(
  name: string,
  date: string,
  time: string,
  office: string,
  referenceNumber: string,
  validId?: string | null,
  personToMeet?: string | null,
  purpose?: string | null,
  contactEmail?: string | null,
  contactPhone?: string | null
) {
  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const contactLines: string[] = [];
  if (contactEmail) contactLines.push(`<strong>Email:</strong> ${escapeHtml(contactEmail)}`);
  if (contactPhone) contactLines.push(`<strong>Phone:</strong> ${escapeHtml(contactPhone)}`);
  const contactBlock = contactLines.length > 0
    ? `<div style="margin-top:20px;padding:12px 16px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;font-size:13px;color:#555;line-height:1.8;">If you have questions about your appointment, contact the office:<br/>${contactLines.join("<br/>")}</div>`
    : `<p style="color:#999;font-size:13px;margin:0;">If you have questions, contact the office directly.</p>`;
  const result = await wrap("Appointment Invitation", `
    <p style="color:#555;margin:0 0 20px;">Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p style="color:#555;margin:0 0 6px;">You have an appointment scheduled with <strong>${escapeHtml(office)}</strong>. Please present your reference number below at the gate for entry. Your ticket is attached to this email as a PDF.</p>
    ${gateNotes(validId || "a government-issued ID")}
    <div style="text-align:center;margin:24px 0;padding:24px;background:#f9fafb;border-radius:12px;border:1px dashed #d1d5db;">
      <p style="margin:0 0 8px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Your Reference Number</p>
      <div style="font-size:34px;font-weight:800;letter-spacing:6px;color:#006633;padding:12px 24px;background:#fff;border:2px solid #006633;border-radius:8px;">${escapeHtml(referenceNumber)}</div>
    </div>
    <p style="color:#999;font-size:12px;margin:0 0 20px;text-align:center;">This reference number is single-use and will be disabled after entry.</p>
    <table style="width:100%;margin:0 0 20px;border-collapse:collapse;background:#f0fdf4;border-radius:8px;overflow:hidden;">
      <tr><td colspan="2" style="padding:12px 16px 8px;font-size:11px;font-weight:600;color:#006633;text-transform:uppercase;letter-spacing:0.5px;">Appointment Details</td></tr>
      ${detailRow("Office", office)}
      ${detailRow("Date", formattedDate)}
      ${detailRow("Time", formatTimeSlot(time))}
      ${personToMeet ? detailRow("Person to Meet", personToMeet) : ""}
      ${purpose ? detailRow("Purpose of Visit", purpose) : ""}
      ${validId ? detailRow("Valid ID to Present", validId) : ""}
      <tr><td style="padding:12px 16px;color:#666;font-size:13px;">Status</td><td style="padding:12px 16px;text-align:right;">${statusBadge("Confirmed", "#006633")}</td></tr>
    </table>
    ${contactBlock}
  `);
  return { html: result.html, attachments: result.attachments };
}

export async function generateContactNotificationEmail(
  contactName: string,
  office: string,
  date: string,
  time: string,
  visitorName: string,
  purpose?: string | null,
  personToMeet?: string | null
) {
  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const result = await wrap("Appointment Scheduled", `
    <p style="color:#555;margin:0 0 20px;">Hi <strong>${escapeHtml(contactName)}</strong>,</p>
    <p style="color:#555;margin:0 0 6px;">A visitor scheduled at <strong>${escapeHtml(office)}</strong> has tagged you on their appointment${personToMeet ? ` to meet <strong>${escapeHtml(personToMeet)}</strong>` : ""}. Please note the schedule below.</p>
    ${bulletList([
      `Date: <strong>${formattedDate}</strong>`,
      `Time: <strong>${formatTimeSlot(time)}</strong>`,
      `Visitor: <strong>${escapeHtml(visitorName)}</strong>`,
      ...(purpose ? [`Purpose: <strong>${escapeHtml(purpose)}</strong>`] : []),
    ])}
    <p style="color:#999;font-size:12px;margin:20px 0 0;">This is an automated notification from USLS OASYS. You will receive a calendar invitation for this appointment.</p>
  `);
  return { html: result.html, attachments: result.attachments };
}
