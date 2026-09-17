import { createServiceClient } from "@/lib/supabase/server";
import { sendMail, generateApprovalEmail, generateDeclineEmail, isNotificationEnabled } from "@/lib/email";
import { createCalendarEvent } from "@/lib/calendar";
import { logAudit } from "@/lib/rbac";
import type { Appointment, Office } from "@/types/database";

export interface AppointmentWithOffice extends Appointment {
  offices?: Office | null;
}

function buildCalendarDescription(appointment: AppointmentWithOffice, referenceNumber: string): string {
  const officeName = appointment.offices?.name || "Unknown Office";
  const officeContact = appointment.offices?.contact_email || appointment.offices?.email || "Not provided";
  const phone = appointment.offices?.contact_phone || "Not provided";

  return [
    "USLS OASYS Appointment",
    "",
    `Visitor: ${appointment.full_name}`,
    `Email: ${appointment.email}`,
    `Phone: ${appointment.phone}`,
    `Visitor category: ${appointment.visitor_category}`,
    `Valid ID to present: ${appointment.valid_id || "Not provided"}`,
    `Person to meet: ${appointment.person_to_meet || "Not provided"}`,
    `Purpose of visit: ${appointment.purpose_of_visit || "Not provided"}`,
    "",
    `Office: ${officeName}`,
    `Office contact email: ${officeContact}`,
    `Office contact phone: ${phone}`,
    "",
    `Appointment date: ${appointment.date}`,
    `Appointment time: ${appointment.time_slot}`,
    `Duration: ${appointment.duration} minutes`,
    `Reference number: ${referenceNumber}`,
    "",
    "Entry location: University of St. La Salle - Gate 2",
  ].join("\n");
}

export async function runPostApprovalTasks(
  appointment: AppointmentWithOffice,
  referenceNumber: string,
  adminId: string | null,
  adminEmail: string
) {
  const startedAt = Date.now();
  let mailResult: { success: boolean; error?: string | null } = { success: false, error: "Notifications disabled" };
  let calendarResult: { id?: string; htmlLink?: string | null; error?: string; skipped: boolean } = { skipped: true };

  try {
    const emailResult = await generateApprovalEmail(
      appointment.full_name,
      appointment.date,
      appointment.time_slot,
      appointment.offices?.name || "Unknown Office",
      appointment.valid_id || "",
      referenceNumber,
      appointment.offices?.contact_email || appointment.offices?.email,
      appointment.offices?.contact_phone
    );

    if (await isNotificationEnabled("approval")) {
      mailResult = await sendMail({
        to: appointment.email,
        subject: `Appointment Approved - ${appointment.full_name} - ${appointment.offices?.name || "Unknown Office"} - USLS OASYS`,
        html: emailResult.html,
        attachments: emailResult.attachments,
      });
    }

    if (!mailResult.success) {
      console.error(mailResult.error);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("approval email generation", msg);
    mailResult = { success: false, error: msg };
  }

  try {
    // date/time_slot are local (Asia/Manila) wall-clock times; build the UTC instant
    // explicitly so Vercel and Google Calendar show the intended appointment time.
    const start = new Date(`${appointment.date}T${appointment.time_slot}:00+08:00`);
    const end = new Date(start.getTime() + (appointment.duration || 30) * 60 * 1000);
    const officeName = appointment.offices?.name || "Unknown Office";
    const attendees = [appointment.email];
    if (appointment.offices?.email) attendees.push(appointment.offices.email);
    const event = await createCalendarEvent({
      title: `Appointment - ${appointment.full_name} (${officeName})`,
      description: buildCalendarDescription(appointment, referenceNumber),
      location: "University of St. La Salle - Gate 2",
      start,
      end,
      attendees,
    });
    calendarResult = { id: event.id, htmlLink: event.htmlLink, skipped: false };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("google calendar event", msg);
    calendarResult = { error: msg, skipped: false };
  }

  const supabase = createServiceClient();

  await supabase.from("email_logs").insert({
    appointment_id: appointment.id,
    type: "approval",
    status: mailResult.success ? "sent" : "failed",
    sent_at: mailResult.success ? new Date().toISOString() : null,
    error_message: mailResult.success ? null : "Failed to send approval email",
  });

  await logAudit(adminId, adminEmail, "approve", {
    appointment_id: appointment.id,
    meta: {
      visitor_name: appointment.full_name,
      visitor_email: appointment.email,
      email_sent: mailResult.success,
      calendar_event_created: calendarResult.skipped ? null : !calendarResult.error,
      calendar_event_id: calendarResult.id,
      calendar_duration_ms: Date.now() - startedAt,
      calendar_error: calendarResult.error || null,
    },
  });
}

export async function runPostDeclineTasks(
  appointment: AppointmentWithOffice,
  reason: string | undefined,
  adminId: string | null,
  adminEmail: string
) {
  let emailResult = { success: false };

  try {
    const emailContent = await generateDeclineEmail(
      appointment.full_name,
      appointment.date,
      appointment.time_slot,
      appointment.offices?.name || "Unknown Office",
      reason,
      appointment.offices?.contact_email || appointment.offices?.email,
      appointment.offices?.contact_phone
    );

    if (await isNotificationEnabled("decline")) {
      emailResult = await sendMail({
        to: appointment.email,
        subject: `Appointment Declined - ${appointment.full_name} - ${appointment.offices?.name || "Unknown Office"} - USLS OASYS`,
        html: emailContent.html,
        attachments: emailContent.attachments,
      });
    }
  } catch (error) {
    console.error(error);
  }

  const supabase = createServiceClient();

  await supabase.from("email_logs").insert({
    appointment_id: appointment.id,
    type: "decline",
    status: emailResult.success ? "sent" : "failed",
    sent_at: emailResult.success ? new Date().toISOString() : null,
    error_message: emailResult.success ? null : "Failed to send decline email",
  });

  await logAudit(adminId, adminEmail, "decline", {
    appointment_id: appointment.id,
    meta: { visitor_name: appointment.full_name, reason },
  });
}