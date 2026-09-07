import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyActionToken, type ActionType } from "@/lib/action-token";
import { createUniqueReference } from "@/lib/reference";
import { runPostApprovalTasks, runPostDeclineTasks, type AppointmentWithOffice } from "@/lib/appointment-actions";
import { mirrorAppointmentToCpanel, fromAppointmentRow } from "@/lib/cpanel-mirror";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface PageOptions {
  stage: "success" | "error" | "already";
  action?: ActionType;
  appointment?: AppointmentWithOffice;
  message?: string;
  baseUrl: string;
}

function renderPage({ stage, action, appointment, message, baseUrl }: PageOptions): Response {
  const isApprove = action === "approve";
  const accent = isApprove ? "#006633" : "#dc2626";
  const adminUrl = `${baseUrl}/admin`;

  let title = "";
  let body = "";

  if (stage === "success") {
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>OAS — Done</title>
<script>try{window.close();}catch(e){}</script></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:440px;margin:24px auto;background:#fff;border-radius:12px;padding:32px 28px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="font-size:16px;font-weight:700;color:#111;">${isApprove ? "Appointment Approved" : "Appointment Denied"}</div>
    <p style="color:#666;font-size:13px;margin:10px 0 0;">Done. You can close this tab and return to your email.</p>
  </div>
  <script>try{setTimeout(function(){window.close();},300);}catch(e){}</script>
</body></html>`,
      {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  } else if (stage === "already") {
    title = "Already Reviewed";
    body = `
      <p style="color:#555;margin:0 0 24px;">This appointment has already been reviewed. Its current status is <strong>${escapeHtml(appointment?.status || "unknown")}</strong>. No further action is needed from this link.</p>
      <p style="text-align:center;margin:0;"><a href="${adminUrl}" style="display:inline-block;background:#006633;color:#fff;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Go to Admin Panel</a></p>
    `;
  } else {
    title = "Action Link Invalid";
    body = `
      <p style="color:#555;margin:0 0 24px;">${escapeHtml(message || "This action link is invalid or has expired.")} Please open the admin panel to review the appointment instead.</p>
      <p style="text-align:center;margin:0;"><a href="${adminUrl}" style="display:inline-block;background:#006633;color:#fff;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Go to Admin Panel</a></p>
    `;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>OAS — ${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:${accent};padding:32px 24px;text-align:center;">
      <div style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:0.5px;">USLS OAS</div>
      <div style="color:rgba(255,255,255,0.85);font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">Online Appointment System</div>
    </div>
    <div style="padding:32px 28px;color:#333;line-height:1.6;font-size:15px;">
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111;">${escapeHtml(title)}</h2>
      <div style="width:40px;height:3px;background:${accent};border-radius:2px;margin-bottom:24px;"></div>
      ${body}
    </div>
    <div style="padding:18px 28px;text-align:center;color:#999;font-size:11px;border-top:1px solid #eee;background:#fafafa;">
      &copy; ${new Date().getFullYear()} OAS &mdash; Online Appointment System<br/>
      University of St. La Salle
    </div>
  </div>
</body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

interface ActionParams {
  action: string | null;
  token: string | null;
}

function getParams(request: Request): ActionParams {
  const url = new URL(request.url);
  return {
    action: url.searchParams.get("action"),
    token: url.searchParams.get("token"),
  };
}

async function executeAction(action: string | null, token: string | null, baseUrl: string): Promise<Response> {
  if (action !== "approve" && action !== "decline") {
    return renderPage({ stage: "error", message: "Invalid action specified.", baseUrl });
  }
  if (!token) {
    return renderPage({ stage: "error", message: "Missing action token.", baseUrl });
  }

  const verified = verifyActionToken(token, action);
  if (!verified.valid || !verified.payload) {
    if (verified.error === "expired") {
      return renderPage({ stage: "error", message: "This link has expired (action links are valid for 72 hours).", baseUrl });
    }
    return renderPage({ stage: "error", message: "This link is invalid and cannot be verified.", baseUrl });
  }

  const appointment = await loadAppointment(verified.payload.appointmentId);
  if (!appointment) {
    return renderPage({ stage: "error", message: "Appointment not found.", baseUrl });
  }

  const auth = await authorizeAdmin(verified.payload.adminEmail, verified.payload.officeId, appointment);
  if (!auth.allowed) {
    return renderPage({ stage: "error", message: auth.message, baseUrl });
  }

  if (appointment.status !== "pending") {
    return renderPage({ stage: "already", action, appointment, baseUrl });
  }

  const supabase = createServiceClient();
  const adminId = auth.adminId ?? null;
  const adminEmail = verified.payload.adminEmail;

  if (action === "approve") {
    const referenceNumber = await createUniqueReference(supabase);
    const updatedAt = new Date().toISOString();
    const [result] = await Promise.all([
      supabase
        .from("appointments")
        .update({
          status: "approved",
          qr_token: referenceNumber,
          qr_used_at: null,
          scanned_at: null,
          updated_at: updatedAt,
        })
        .eq("id", appointment.id),
      mirrorAppointmentToCpanel(
        fromAppointmentRow(appointment, {
          status: "approved",
          qr_token: referenceNumber,
          qr_used_at: null,
          scanned_at: null,
          updated_at: updatedAt,
        })
      ),
    ]);
    const { error } = result;

    if (error) {
      console.error("Email approve failed:", error);
      return renderPage({ stage: "error", message: "Failed to update the appointment. Please try again or use the admin panel.", baseUrl });
    }

    after(async () => {
      await runPostApprovalTasks(appointment, referenceNumber, adminId, adminEmail);
    });
  } else {
    const updatedAt = new Date().toISOString();
    const [result] = await Promise.all([
      supabase
        .from("appointments")
        .update({
          status: "declined",
          decline_reason: null,
          updated_at: updatedAt,
        })
        .eq("id", appointment.id),
      mirrorAppointmentToCpanel(
        fromAppointmentRow(appointment, {
          status: "declined",
          decline_reason: null,
          updated_at: updatedAt,
        })
      ),
    ]);
    const { error } = result;

    if (error) {
      console.error("Email decline failed:", error);
      return renderPage({ stage: "error", message: "Failed to update the appointment. Please try again or use the admin panel.", baseUrl });
    }

    after(async () => {
      await runPostDeclineTasks(appointment, undefined, adminId, adminEmail);
    });
  }

  return renderPage({ stage: "success", action, appointment, baseUrl });
}

// The email "Approve / Deny" buttons link here (GET) and act immediately — no
// intermediate confirmation page. POST is kept for the legacy confirm form.
export async function GET(request: Request) {
  const { action, token } = getParams(request);
  const baseUrl = new URL(request.url).origin;
  return executeAction(action, token, baseUrl);
}

export async function POST(request: Request) {
  const { action, token } = getParams(request);
  const baseUrl = new URL(request.url).origin;
  return executeAction(action, token, baseUrl);
}

async function loadAppointment(id: string): Promise<AppointmentWithOffice | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("*, offices(*)")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data as AppointmentWithOffice;
}

async function authorizeAdmin(
  adminEmail: string | undefined,
  tokenOfficeId: string | null,
  appointment: AppointmentWithOffice
): Promise<{ allowed: boolean; message?: string; adminId?: string | null }> {
  const supabase = createServiceClient();

  if (adminEmail) {
    const { data: adminRow } = await supabase
      .from("admins")
      .select("id, role, office_id")
      .eq("email", adminEmail)
      .single();

    if (adminRow) {
      if (adminRow.role === "office_admin" && adminRow.office_id !== appointment.office_id) {
        return { allowed: false, message: "You do not have permission to act on appointments for this office." };
      }
      return { allowed: true, adminId: adminRow.id };
    }
  }

  // No matching admin row found — token must be scoped to the appointment's office.
  if (tokenOfficeId !== appointment.office_id) {
    return { allowed: false, message: "You do not have permission to act on this appointment." };
  }
  return { allowed: true, adminId: null };
}