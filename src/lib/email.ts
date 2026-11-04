import { AsyncLocalStorage } from "async_hooks";
import nodemailer from "nodemailer";
import { readFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";
import { createServiceClient } from "@/lib/supabase/server";
import { formatTimeSlot } from "@/lib/time";
import { getArrivalNote, getEntryRuleNote } from "@/lib/entry-window";
import { getEntryWindow } from "@/lib/entry-window-server";
import { escapeHtml, getEmailFields, renderEmailText, type EmailPlaceholderValues, type EmailTemplateType } from "@/lib/email-templates";
import { generateQrPng } from "@/lib/qr";

export { escapeHtml };

export { sanitizeError } from "@/lib/http";

// Lets the Settings preview render unsaved text without changing what real emails send.
const emailTextOverrides = new AsyncLocalStorage<Record<string, string>>();

export function withEmailTextOverrides<R>(overrides: Record<string, string>, render: () => Promise<R>): Promise<R> {
  return emailTextOverrides.run(overrides, render);
}

// A failed read just means the default text; it must never stop an email from going out.
async function getEmailText<T extends EmailTemplateType>(type: T, values: EmailPlaceholderValues) {
  const saved: Record<string, string> = {};
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", [...getEmailFields(type), ...getEmailFields("shared")].map(({ key }) => key));
    data?.forEach((row) => { saved[row.key] = row.value; });
  } catch (err) {
    console.error(`Failed to load email text for "${type}":`, err);
  }
  return renderEmailText(type, { ...saved, ...emailTextOverrides.getStore() }, values);
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

async function getQrAttachment(text: string): Promise<SendMailAttachments> {
  return {
    filename: "qrcode.png",
    content: await generateQrPng(text),
    cid: "qrcode",
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

async function gateNoteExtras(validId: string) {
  const entryWindow = await getEntryWindow();
  return {
    valid_id: `<strong>${escapeHtml(validId)}</strong>`,
    arrival_note: escapeHtml(getArrivalNote(entryWindow)),
    entry_rule: escapeHtml(getEntryRuleNote(entryWindow)),
  };
}

export async function generateBookingConfirmationEmail(name: string, date: string, time: string, office: string, validId: string, contactEmail?: string | null, contactPhone?: string | null, visitors?: EmailVisitor[]) {
  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const contactLines: string[] = [];
  if (contactEmail) contactLines.push(`<strong>Email:</strong> ${escapeHtml(contactEmail)}`);
  if (contactPhone) contactLines.push(`<strong>Phone:</strong> ${escapeHtml(contactPhone)}`);
  const text = await getEmailText("confirmation", { name, office, date: formattedDate, time: formatTimeSlot(time) });
  const contactBlock = contactLines.length > 0
    ? `<div style="margin-top:20px;padding:12px 16px;background:#f0f7ff;border-radius:8px;border:1px solid #d0e3f7;font-size:13px;color:#555;line-height:1.8;">${text.html("contact_intro")}<br/>${contactLines.join("<br/>")}</div>`
    : `<p style="color:#999;font-size:13px;margin:0;">${text.html("contact_fallback")}</p>`;
  const result = await wrap(text.html("heading"), `
    <p style="color:#555;margin:0 0 20px;">${text.html("greeting")}</p>
    <p style="color:#555;margin:0 0 24px;">${text.html("message")}</p>
    ${bulletList(text.lines("gate_notes", await gateNoteExtras(validId)))}
    <table style="width:100%;margin:0 0 24px;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;">
      <tr><td colspan="2" style="padding:12px 16px 8px;font-size:11px;font-weight:600;color:#006633;text-transform:uppercase;letter-spacing:0.5px;">${text.html("details_title")}</td></tr>
      ${detailRow(text.label("label_office"), office)}
      ${detailRow(text.label("label_date"), formattedDate)}
      ${detailRow(text.label("label_time"), formatTimeSlot(time))}
      <tr><td style="padding:12px 16px;color:#666;font-size:13px;">${escapeHtml(text.label("label_status"))}</td><td style="padding:12px 16px;text-align:right;">${statusBadge(escapeHtml(text.plain("status_label")), "#b45309")}</td></tr>
    </table>
    ${visitorDetails(visitors)}
    ${contactBlock}
  `);
  return { subject: text.plain("subject"), html: result.html, attachments: result.attachments };
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
    ${time ? "" : `<p style="color:#555;font-size:13px;margin:24px 0 0;text-align:center;">This office sets the visit time when approving. Open the dashboard to choose a time and approve or decline.</p>`}
    <div style="text-align:center;margin:${time ? "28px" : "16px"} 0 12px;">
      <a href="${dashboardUrl}" style="display:inline-block;background:#006633;color:#fff;padding:13px 32px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">${time ? "Review Appointment" : "Open Dashboard"}</a>
    </div>`;

  const text = await getEmailText("admin_alert", { name, office, date: formattedDate, time: time ? formatTimeSlot(time) : "To be set by the office" });
  const result = await wrap(text.html("heading"), `
    <p style="color:#555;margin:0 0 20px;">${text.html("message")}</p>
    <table style="width:100%;margin:0 0 0;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;">
      <tr><td colspan="2" style="padding:12px 16px 8px;font-size:11px;font-weight:600;color:#006633;text-transform:uppercase;letter-spacing:0.5px;">${text.html("details_title")}</td></tr>
      ${detailRow(text.label("label_name"), name)}
      ${detailRow(text.label("label_office"), office)}
      ${detailRow(text.label("label_date"), formattedDate)}
      ${detailRow(text.label("label_time"), time ? formatTimeSlot(time) : "To be set by the office")}
      ${visitors && visitors.length > 1 ? detailRow(text.label("label_visitors"), String(visitors.length)) : ""}
    </table>
    ${visitorDetails(visitors)}
    ${actionBlock}
    <p style="color:#999;font-size:12px;margin:0;">${text.html("footer_note")}</p>
  `);
  return { subject: text.plain("subject"), html: result.html, attachments: result.attachments };
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
  visitors?: EmailVisitor[],
  templateType: "approval" | "qr_resend" = "approval"
) {
  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const contactLines: string[] = [];
  if (contactEmail) contactLines.push(`<strong>Email:</strong> ${escapeHtml(contactEmail)}`);
  if (contactPhone) contactLines.push(`<strong>Phone:</strong> ${escapeHtml(contactPhone)}`);
  const text = await getEmailText(templateType, { name, office, date: formattedDate, time: formatTimeSlot(time) });
  const contactBlock = contactLines.length > 0
    ? `<div style="margin-top:20px;padding:12px 16px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;font-size:13px;color:#555;line-height:1.8;">${text.html("contact_intro")}<br/>${contactLines.join("<br/>")}</div>`
    : `<p style="color:#999;font-size:13px;margin:0;">${text.html("contact_fallback")}</p>`;
  const result = await wrap(text.html("heading"), `
    <p style="color:#555;margin:0 0 20px;">${text.html("greeting")}</p>
    <p style="color:#555;margin:0 0 6px;">${text.html("message")}</p>
    ${bulletList(text.lines("gate_notes", await gateNoteExtras(validId)))}
    <div style="text-align:center;margin:24px 0;padding:24px;background:#f9fafb;border-radius:12px;border:1px dashed #d1d5db;">
      <p style="margin:0 0 8px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(text.label("reference_title"))}</p>
      <div style="font-size:34px;font-weight:800;letter-spacing:6px;color:#006633;padding:12px 24px;background:#fff;border:2px solid #006633;border-radius:8px;">${escapeHtml(referenceNumber)}</div>
      <img src="cid:qrcode" alt="QR Code" style="width:200px;height:200px;margin-top:16px;border:2px solid #006633;border-radius:8px;padding:6px;background:#fff;" />
    </div>
    <p style="color:#999;font-size:12px;margin:0 0 20px;text-align:center;">${text.html("reference_note")}</p>
    <table style="width:100%;margin:0 0 20px;border-collapse:collapse;background:#f0fdf4;border-radius:8px;overflow:hidden;">
      <tr><td colspan="2" style="padding:12px 16px 8px;font-size:11px;font-weight:600;color:#006633;text-transform:uppercase;letter-spacing:0.5px;">${text.html("details_title")}</td></tr>
      ${detailRow(text.label("label_office"), office)}
      ${detailRow(text.label("label_date"), formattedDate)}
      ${detailRow(text.label("label_time"), formatTimeSlot(time))}
      ${detailRow(text.label("label_valid_id"), validId)}
      <tr><td style="padding:12px 16px;color:#666;font-size:13px;">${escapeHtml(text.label("label_status"))}</td><td style="padding:12px 16px;text-align:right;">${statusBadge(escapeHtml(text.plain("status_label")), "#006633")}</td></tr>
    </table>
    ${visitorDetails(visitors)}
    ${contactBlock}
  `, [await getQrAttachment(referenceNumber)]);
  return { subject: text.plain("subject"), html: result.html, attachments: result.attachments };
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
  const text = await getEmailText("decline", { name, office, date: formattedDate, time: formatTimeSlot(time) });
  const contactBlock = contactLines.length > 0
    ? `<div style="margin-top:16px;padding:12px 16px;background:#fef2f2;border-radius:8px;border:1px solid #fecaca;font-size:13px;color:#555;line-height:1.8;">${text.html("contact_intro")}<br/>${contactLines.join("<br/>")}</div>`
    : `<p style="color:#999;font-size:13px;margin:14px 0 0;">${text.html("contact_fallback")}</p>`;
  const bookingLink = `<a href="${bookingUrl}" style="color:#006633;font-weight:600;text-decoration:underline;">${text.html("booking_link_text")}</a>`;
  const result = await wrap(text.html("heading"), `
    <p style="color:#555;margin:0 0 20px;">${text.html("greeting")}</p>
    <p style="color:#555;margin:0 0 24px;">${text.html("message")}</p>
    ${bulletList([
      reason ? text.html("reason_text", { reason: `<strong>${escapeHtml(reason)}</strong>` }) : text.html("no_reason_text", { office_contact: officeContact }),
      text.html("rebook_text", { booking_link: bookingLink, office_contact: officeContact }),
    ])}
    <table style="width:100%;margin:0 0 20px;border-collapse:collapse;background:#fef2f2;border-radius:8px;overflow:hidden;">
      <tr><td colspan="2" style="padding:12px 16px 8px;font-size:11px;font-weight:600;color:#dc2626;text-transform:uppercase;letter-spacing:0.5px;">${text.html("details_title")}</td></tr>
      ${detailRow(text.label("label_office"), office)}
      ${detailRow(text.label("label_date"), formattedDate)}
      ${detailRow(text.label("label_time"), formatTimeSlot(time))}
      <tr><td style="padding:12px 16px;color:#666;font-size:13px;">${escapeHtml(text.label("label_status"))}</td><td style="padding:12px 16px;text-align:right;">${statusBadge(escapeHtml(text.plain("status_label")), "#dc2626")}</td></tr>
    </table>
    ${visitorDetails(visitors)}
    ${contactBlock}
  `);
  return { subject: text.plain("subject"), html: result.html, attachments: result.attachments };
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
  const text = await getEmailText("postponement", { name, office, date: formattedNew, time: formatTimeSlot(newTime) });
  const contactBlock = contactLines.length > 0
    ? `<div style="margin-top:16px;padding:12px 16px;background:#fffbeb;border-radius:8px;border:1px solid #fde68a;font-size:13px;color:#555;line-height:1.8;">${text.html("contact_intro")}<br/>${contactLines.join("<br/>")}</div>`
    : `<p style="color:#999;font-size:13px;margin:14px 0 0;">${text.html("contact_fallback")}</p>`;
  const result = await wrap(text.html("heading"), `
    <p style="color:#555;margin:0 0 20px;">${text.html("greeting")}</p>
    <p style="color:#555;margin:0 0 6px;">${text.html("message")}</p>
    ${bulletList([
      `${text.html("schedule_text")}${reason ? ` &mdash; ${escapeHtml(reason)}` : ""}`,
      text.html("reference_note"),
    ])}
    <table style="width:100%;margin:0 0 20px;border-collapse:collapse;background:#fff7ed;border-radius:8px;overflow:hidden;">
      <tr><td colspan="2" style="padding:12px 16px 8px;font-size:11px;font-weight:600;color:#b45309;text-transform:uppercase;letter-spacing:0.5px;">${text.html("original_title")}</td></tr>
      ${detailRow(text.label("label_office"), office)}
      ${detailRow(text.label("label_date"), formattedOriginal)}
      ${detailRow(text.label("label_time"), formatTimeSlot(originalTime))}
    </table>
    <table style="width:100%;margin:0 0 20px;border-collapse:collapse;background:#f0fdf4;border-radius:8px;overflow:hidden;">
      <tr><td colspan="2" style="padding:12px 16px 8px;font-size:11px;font-weight:600;color:#006633;text-transform:uppercase;letter-spacing:0.5px;">${text.html("new_title")}</td></tr>
      ${detailRow(text.label("label_office"), office)}
      ${detailRow(text.label("label_date"), formattedNew)}
      ${detailRow(text.label("label_time"), formatTimeSlot(newTime))}
      <tr><td style="padding:12px 16px;color:#666;font-size:13px;">${escapeHtml(text.label("label_status"))}</td><td style="padding:12px 16px;text-align:right;">${statusBadge(escapeHtml(text.plain("status_label")), "#b45309")}</td></tr>
    </table>
    ${visitorDetails(visitors)}
    ${contactBlock}
  `);
  return { subject: text.plain("subject"), html: result.html, attachments: result.attachments };
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
  const text = await getEmailText("invitation", { name, office, date: formattedDate, time: formatTimeSlot(time) });
  const contactBlock = contactLines.length > 0
    ? `<div style="margin-top:20px;padding:12px 16px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;font-size:13px;color:#555;line-height:1.8;">${text.html("contact_intro")}<br/>${contactLines.join("<br/>")}</div>`
    : `<p style="color:#999;font-size:13px;margin:0;">${text.html("contact_fallback")}</p>`;
  const result = await wrap(text.html("heading"), `
    <p style="color:#555;margin:0 0 20px;">${text.html("greeting")}</p>
    <p style="color:#555;margin:0 0 6px;">${text.html("message")}</p>
    ${bulletList(text.lines("gate_notes", await gateNoteExtras(validId || "a government-issued ID")))}
    <div style="text-align:center;margin:24px 0;padding:24px;background:#f9fafb;border-radius:12px;border:1px dashed #d1d5db;">
      <p style="margin:0 0 8px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(text.label("reference_title"))}</p>
      <div style="font-size:34px;font-weight:800;letter-spacing:6px;color:#006633;padding:12px 24px;background:#fff;border:2px solid #006633;border-radius:8px;">${escapeHtml(referenceNumber)}</div>
      <img src="cid:qrcode" alt="QR Code" style="width:200px;height:200px;margin-top:16px;border:2px solid #006633;border-radius:8px;padding:6px;background:#fff;" />
    </div>
    <p style="color:#999;font-size:12px;margin:0 0 20px;text-align:center;">${text.html("reference_note")}</p>
    <table style="width:100%;margin:0 0 20px;border-collapse:collapse;background:#f0fdf4;border-radius:8px;overflow:hidden;">
      <tr><td colspan="2" style="padding:12px 16px 8px;font-size:11px;font-weight:600;color:#006633;text-transform:uppercase;letter-spacing:0.5px;">${text.html("details_title")}</td></tr>
      ${detailRow(text.label("label_office"), office)}
      ${detailRow(text.label("label_date"), formattedDate)}
      ${detailRow(text.label("label_time"), formatTimeSlot(time))}
      ${personToMeet ? detailRow(text.label("label_person"), personToMeet) : ""}
      ${purpose ? detailRow(text.label("label_purpose"), purpose) : ""}
      ${validId ? detailRow(text.label("label_valid_id"), validId) : ""}
      <tr><td style="padding:12px 16px;color:#666;font-size:13px;">${escapeHtml(text.label("label_status"))}</td><td style="padding:12px 16px;text-align:right;">${statusBadge(escapeHtml(text.plain("status_label")), "#006633")}</td></tr>
    </table>
    ${contactBlock}
  `, [await getQrAttachment(referenceNumber)]);
  return { subject: text.plain("subject"), html: result.html, attachments: result.attachments };
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

export async function generatePersonToMeetApprovalEmail(
  personName: string,
  office: string,
  date: string,
  time: string,
  visitorName: string,
  referenceNumber: string,
  purpose?: string | null,
  contactEmail?: string | null,
  contactPhone?: string | null
) {
  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const contactLines: string[] = [];
  if (contactEmail) contactLines.push(`<strong>Email:</strong> ${escapeHtml(contactEmail)}`);
  if (contactPhone) contactLines.push(`<strong>Phone:</strong> ${escapeHtml(contactPhone)}`);
  const result = await wrap("Appointment Approved - Person to Meet", `
    <p style="color:#555;margin:0 0 20px;">Hi <strong>${escapeHtml(personName)}</strong>,</p>
    <p style="color:#555;margin:0 0 6px;">Your appointment with a visitor at <strong>${escapeHtml(office)}</strong> has been approved. Please note the details below.</p>
    ${bulletList([
      `Reference No.: <strong>${escapeHtml(referenceNumber)}</strong>`,
      `Date: <strong>${formattedDate}</strong>`,
      `Time: <strong>${formatTimeSlot(time)}</strong>`,
      `Visitor: <strong>${escapeHtml(visitorName)}</strong>`,
      ...(purpose ? [`Purpose: <strong>${escapeHtml(purpose)}</strong>`] : []),
    ])}
    ${contactLines.length > 0
      ? `<div style="margin-top:20px;padding:12px 16px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;font-size:13px;color:#555;line-height:1.8;">For questions, contact the office:<br/>${contactLines.join("<br/>")}</div>`
      : ""}
    <p style="color:#999;font-size:12px;margin:20px 0 0;">This is an automated notification from USLS OASYS.</p>
  `);
  return { html: result.html, attachments: result.attachments };
}

export async function generateAccountApprovalRequestEmail(name: string, email: string, office: string, baseUrl: string) {
  const accountsUrl = `${baseUrl}/admin/accounts`;
  const result = await wrap("Account Awaiting Approval", `
    <p style="color:#555;margin:0 0 20px;">A new office admin account was registered and needs a super admin to approve it before it can sign in.</p>
    ${bulletList([
      `Name: <strong>${escapeHtml(name)}</strong>`,
      `Email: <strong>${escapeHtml(email)}</strong>`,
      `Office: <strong>${escapeHtml(office)}</strong>`,
    ])}
    <div style="text-align:center;margin:28px 0 12px;">
      <a href="${accountsUrl}" style="display:inline-block;background:#006633;color:#fff;padding:13px 32px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Review Account</a>
    </div>
    <p style="color:#999;font-size:12px;margin:0;">Only approve accounts for people you know work in this office. You are receiving this because you are a super admin.</p>
  `);
  return { html: result.html, attachments: result.attachments };
}

export async function generateAccountApprovedEmail(name: string, office: string, baseUrl: string) {
  const loginUrl = `${baseUrl}/admin/login`;
  const result = await wrap("Account Approved", `
    <p style="color:#555;margin:0 0 20px;">Hi <strong>${escapeHtml(name)}</strong>,</p>
    <p style="color:#555;margin:0 0 6px;">Your office admin account for <strong>${escapeHtml(office)}</strong> has been approved. You can now sign in to the admin dashboard.</p>
    <div style="text-align:center;margin:28px 0 12px;">
      <a href="${loginUrl}" style="display:inline-block;background:#006633;color:#fff;padding:13px 32px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Sign In</a>
    </div>
  `);
  return { html: result.html, attachments: result.attachments };
}

export async function generateSubOfficeTagEmail(
  subOffice: string,
  mainOffice: string,
  visitorName: string,
  date: string,
  time: string | null,
  status: string,
  baseUrl: string
) {
  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const dashboardUrl = `${baseUrl}/admin`;
  const result = await wrap("Your Office Was Tagged on an Appointment", `
    <p style="color:#555;margin:0 0 20px;"><strong>${escapeHtml(mainOffice)}</strong> tagged <strong>${escapeHtml(subOffice)}</strong> on an appointment so your office is aware of the visit.</p>
    ${bulletList([
      `Visitor: <strong>${escapeHtml(visitorName)}</strong>`,
      `Date: <strong>${formattedDate}</strong>`,
      `Time: <strong>${time ? formatTimeSlot(time) : "To be set by the office"}</strong>`,
      `Status: <strong>${escapeHtml(status.charAt(0).toUpperCase() + status.slice(1))}</strong>`,
    ])}
    <div style="text-align:center;margin:28px 0 12px;">
      <a href="${dashboardUrl}" style="display:inline-block;background:#006633;color:#fff;padding:13px 32px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Open Dashboard</a>
    </div>
    <p style="color:#999;font-size:12px;margin:0;">You are receiving this because your office was tagged on this appointment in USLS OASYS.</p>
  `);
  return { html: result.html, attachments: result.attachments };
}
