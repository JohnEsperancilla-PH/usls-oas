import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { getAuthAdmin, requireSuperAdmin } from "@/lib/rbac";
import { validateCsrfToken, csrfErrorResponse } from "@/lib/csrf";
import {
  generateAdminAlertEmail,
  generateApprovalEmail,
  generateBookingConfirmationEmail,
  generateDeclineEmail,
  generateInvitationEmail,
  generatePostponementEmail,
  withEmailTextOverrides,
} from "@/lib/email";
import { EMAIL_TEMPLATE_KEYS, type EmailTemplateType } from "@/lib/email-templates";
import { addDays } from "@/lib/booking-rules";
import { getManilaToday } from "@/lib/time";

const VISITOR = "Juan Dela Cruz";
const OFFICE = "Sample Office";
const VALID_ID = "Driver's License";
const REFERENCE = "SAMPLE123";
const OFFICE_EMAIL = "office@usls.edu.ph";
const OFFICE_PHONE = "(034) 000-0000";

function renderSample(type: EmailTemplateType, origin: string) {
  const date = addDays(getManilaToday(), 7);
  const time = "09:00";
  switch (type) {
    case "confirmation":
      return generateBookingConfirmationEmail(VISITOR, date, time, OFFICE, VALID_ID, OFFICE_EMAIL, OFFICE_PHONE);
    case "admin_alert":
      return generateAdminAlertEmail(VISITOR, date, time, OFFICE, "sample", origin, { approveUrl: "#", declineUrl: "#" });
    case "approval":
    case "qr_resend":
      return generateApprovalEmail(VISITOR, date, time, OFFICE, VALID_ID, REFERENCE, OFFICE_EMAIL, OFFICE_PHONE, undefined, type);
    case "decline":
      return generateDeclineEmail(VISITOR, date, time, OFFICE, "Sample reason from the office", OFFICE_EMAIL, OFFICE_PHONE);
    case "postponement":
      return generatePostponementEmail(VISITOR, date, time, addDays(date, 1), "10:00", OFFICE, "Sample reason from the office", OFFICE_EMAIL, OFFICE_PHONE);
    case "invitation":
      return generateInvitationEmail(VISITOR, date, time, OFFICE, REFERENCE, VALID_ID, "Maria Santos", "Sample purpose of visit", OFFICE_EMAIL, OFFICE_PHONE);
  }
}

const PREVIEW_TYPES = new Set<string>(["confirmation", "admin_alert", "approval", "qr_resend", "decline", "postponement", "invitation"]);

// Renders a sample of the real email with the text currently on the Settings page. Nothing is saved or sent.
export async function POST(request: Request) {
  const csrfValid = await validateCsrfToken(request);
  if (!csrfValid) return csrfErrorResponse();

  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });

    const access = requireSuperAdmin(admin);
    if (!access.ok) return NextResponse.json({ message: access.error }, { status: access.status });

    const body = await request.json().catch(() => ({}));
    if (typeof body.type !== "string" || !PREVIEW_TYPES.has(body.type)) {
      return NextResponse.json({ message: "Unknown email type" }, { status: 400 });
    }

    const overrides: Record<string, string> = {};
    for (const key of EMAIL_TEMPLATE_KEYS) {
      const value = body.text?.[key];
      if (typeof value === "string") overrides[key] = value;
    }

    const origin = new URL(request.url).origin;
    const email = await withEmailTextOverrides(overrides, () => renderSample(body.type as EmailTemplateType, origin));

    // Emails reference images by content ID, which a browser can't load, so they're embedded here.
    let html = email.html;
    for (const attachment of email.attachments) {
      if (!attachment.cid) continue;
      const data = Buffer.from(attachment.content).toString("base64");
      html = html.split(`cid:${attachment.cid}`).join(`data:${attachment.contentType};base64,${data}`);
    }

    return NextResponse.json({ subject: email.subject, html });
  } catch (error) {
    return handleRouteError(error);
  }
}
