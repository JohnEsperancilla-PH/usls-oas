import { createServiceClient } from "@/lib/supabase/server";
import { sendMail, generateApprovalEmail, generateDeclineEmail, generatePostponementEmail, generateInvitationEmail, generateContactNotificationEmail, isNotificationEnabled } from "@/lib/email";
import { createCalendarEvent } from "@/lib/calendar";
import { logAudit } from "@/lib/rbac";
import type { Appointment, AppointmentContact, Office } from "@/types/database";
import { getAppointmentVisitors } from "@/lib/appointment-visitors";
import { getAppointmentVehicles } from "@/lib/appointment-vehicles";
import { generateTicketPdf } from "@/lib/ticket";

export interface AppointmentWithOffice extends Appointment {
  offices?: Office | null;
  contacts?: AppointmentContact[];
}

function buildCalendarDescription(appointment: AppointmentWithOffice, referenceNumber: string): string {
  const officeName = appointment.offices?.name || "Unknown Office";
  const officeContact = appointment.offices?.contact_email || appointment.offices?.email || "Not provided";
  const phone = appointment.offices?.contact_phone || "Not provided";
  const visitorLines = (appointment.visitors || []).map((visitor) => `${visitor.full_name} (${visitor.valid_id})`);
  const vehicleLines = (appointment.vehicles || []).map((vehicle) => `${vehicle.plate_number}${vehicle.make_model ? ` (${vehicle.make_model})` : ""}`);
  const contactLines = (appointment.contacts || []).map((contact) => `${contact.name}${contact.position ? ` (${contact.position})` : ""} <${contact.email}>`);

  return [
    "USLS OASYS Appointment",
    "",
    `Visitor: ${appointment.full_name}`,
    `Email: ${appointment.email}`,
    `Phone: ${appointment.phone}`,
    `Visitor category: ${appointment.visitor_category}`,
    `Valid ID to present: ${appointment.valid_id || "Not provided"}`,
     `Number of visitors: ${appointment.visitor_count || visitorLines.length || 1}`,
     visitorLines.length > 1 ? `Additional visitors: ${visitorLines.slice(1).join(", ")}` : "",
    `Person to meet: ${appointment.person_to_meet || "Not provided"}`,
    `Purpose of visit: ${appointment.purpose_of_visit || "Not provided"}`,
    vehicleLines.length > 0 ? `Number of vehicles: ${vehicleLines.length}` : "",
    vehicleLines.length > 0 ? `Vehicles: ${vehicleLines.join(", ")}` : "",
    contactLines.length > 0 ? `Tagged office contacts: ${contactLines.join(", ")}` : "",
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
  const visitors = appointment.visitors || await getAppointmentVisitors(createServiceClient(), appointment.id);
  const vehicles = appointment.vehicles || await getAppointmentVehicles(createServiceClient(), appointment.id);
  const appointmentWithVisitors = { ...appointment, visitors, vehicles };
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
      appointment.offices?.contact_phone,
      visitors.map((visitor) => ({ fullName: visitor.full_name, validId: visitor.valid_id, isBooker: visitor.is_booker }))
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
      title: `Appointment - ${appointmentWithVisitors.full_name} (${officeName})`,
      description: buildCalendarDescription(appointmentWithVisitors, referenceNumber),
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
  const visitors = appointment.visitors || await getAppointmentVisitors(createServiceClient(), appointment.id);
  let emailResult = { success: false };

  try {
    const emailContent = await generateDeclineEmail(
      appointment.full_name,
      appointment.date,
      appointment.time_slot,
      appointment.offices?.name || "Unknown Office",
      reason,
      appointment.offices?.contact_email || appointment.offices?.email,
      appointment.offices?.contact_phone,
      visitors.map((visitor) => ({ fullName: visitor.full_name, validId: visitor.valid_id, isBooker: visitor.is_booker }))
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

export async function runPostponementTasks(
  appointment: AppointmentWithOffice,
  newDate: string,
  newTimeSlot: string,
  reason: string | undefined,
  adminId: string | null,
  adminEmail: string
) {
  const visitors = appointment.visitors || await getAppointmentVisitors(createServiceClient(), appointment.id);
  let mailResult: { success: boolean; error?: string | null } = { success: false, error: "Notifications disabled" };

  try {
    const emailContent = await generatePostponementEmail(
      appointment.full_name,
      appointment.date,
      appointment.time_slot,
      newDate,
      newTimeSlot,
      appointment.offices?.name || "Unknown Office",
      reason,
      appointment.offices?.contact_email || appointment.offices?.email,
      appointment.offices?.contact_phone,
      visitors.map((visitor) => ({ fullName: visitor.full_name, validId: visitor.valid_id, isBooker: visitor.is_booker }))
    );

    if (await isNotificationEnabled("postponement")) {
      mailResult = await sendMail({
        to: appointment.email,
        subject: `Appointment Postponed - ${appointment.full_name} - ${appointment.offices?.name || "Unknown Office"} - USLS OASYS`,
        html: emailContent.html,
        attachments: emailContent.attachments,
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("postponement email", msg);
    mailResult = { success: false, error: msg };
  }

  const supabase = createServiceClient();

  await supabase.from("email_logs").insert({
    appointment_id: appointment.id,
    type: "postponement",
    status: mailResult.success ? "sent" : "failed",
    sent_at: mailResult.success ? new Date().toISOString() : null,
    error_message: mailResult.success ? null : "Failed to send postponement email",
  });

  await logAudit(adminId, adminEmail, "postpone", {
    appointment_id: appointment.id,
    meta: {
      visitor_name: appointment.full_name,
      original_date: appointment.date,
      original_time: appointment.time_slot,
      new_date: newDate,
      new_time: newTimeSlot,
      reason,
      email_sent: mailResult.success,
    },
  });
}

export async function runInvitationTasks(
  appointment: AppointmentWithOffice,
  referenceNumber: string,
  adminId: string | null,
  adminEmail: string
) {
  const officeName = appointment.offices?.name || "Unknown Office";
  const hasEmail = Boolean(appointment.email);
  const taggedContacts = appointment.contacts || [];
  let mailResult: { success: boolean; error?: string | null } = { success: false, error: hasEmail ? "Notifications disabled" : "No email address provided" };
  let contactsMailResult: { success: boolean; error?: string | null } = { success: false, error: "No tagged office contacts" };

  try {
    if (hasEmail) {
      const emailContent = await generateInvitationEmail(
        appointment.full_name,
        appointment.date,
        appointment.time_slot,
        officeName,
        referenceNumber,
        appointment.valid_id,
        appointment.person_to_meet,
        appointment.purpose_of_visit,
        appointment.offices?.contact_email || appointment.offices?.email,
        appointment.offices?.contact_phone
      );

      const attachments = [...emailContent.attachments];
      try {
        const ticketPdf = await generateTicketPdf({
          referenceNumber,
          visitorName: appointment.full_name,
          officeName,
          date: appointment.date,
          timeSlot: appointment.time_slot,
          duration: appointment.duration || 30,
          validId: appointment.valid_id,
          personToMeet: appointment.person_to_meet,
          purpose: appointment.purpose_of_visit,
          vehicles: (appointment.vehicles || []).map((vehicle) => ({ plateNumber: vehicle.plate_number, makeModel: vehicle.make_model })),
        });
        attachments.push({
          filename: `USLS-OASYS-Ticket-${referenceNumber}.pdf`,
          content: Buffer.from(ticketPdf),
          contentType: "application/pdf",
        });
      } catch (error) {
        console.error("ticket pdf generation", error instanceof Error ? error.message : String(error));
      }

      if (await isNotificationEnabled("invitation")) {
        mailResult = await sendMail({
          to: appointment.email,
          subject: `Appointment Invitation - ${appointment.full_name} - ${officeName} - USLS OASYS`,
          html: emailContent.html,
          attachments,
        });
      }
    }

    // Notify tagged office contacts (plain notification, no ticket PDF).
    const contactEmails = taggedContacts.map((contact) => contact.email).filter(Boolean);
    if (contactEmails.length > 0 && await isNotificationEnabled("invitation")) {
      const contactsEmail = await generateContactNotificationEmail(
        taggedContacts[0].name,
        officeName,
        appointment.date,
        appointment.time_slot,
        appointment.full_name,
        appointment.purpose_of_visit,
        appointment.person_to_meet
      );
      contactsMailResult = await sendMail({
        to: contactEmails.join(", "),
        subject: `Appointment scheduled with ${officeName} - ${appointment.full_name} - USLS OASYS`,
        html: contactsEmail.html,
        attachments: contactsEmail.attachments,
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("invitation email", msg);
    mailResult = { success: false, error: msg };
  }

  let calendarResult: { id?: string; htmlLink?: string | null; error?: string; skipped: boolean } = { skipped: true };
  try {
    const start = new Date(`${appointment.date}T${appointment.time_slot}:00+08:00`);
    const end = new Date(start.getTime() + (appointment.duration || 30) * 60 * 1000);
    const attendees = appointment.email ? [appointment.email] : [];
    for (const contact of taggedContacts) {
      if (contact.email && !attendees.includes(contact.email)) attendees.push(contact.email);
    }
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
    console.error("google calendar event (invitation)", msg);
    calendarResult = { error: msg, skipped: false };
  }

  const supabase = createServiceClient();

  if (hasEmail) {
    await supabase.from("email_logs").insert({
      appointment_id: appointment.id,
      type: "invitation",
      status: mailResult.success ? "sent" : "failed",
      sent_at: mailResult.success ? new Date().toISOString() : null,
      error_message: mailResult.success ? null : "Failed to send invitation email",
    });
  }

  await logAudit(adminId, adminEmail, "create_invitation", {
    appointment_id: appointment.id,
    meta: {
      visitor_name: appointment.full_name,
      visitor_email: appointment.email || null,
      reference_number: referenceNumber,
      email_sent: mailResult.success,
      contacts_notified: contactsMailResult.success,
      tagged_contacts: taggedContacts.map((contact) => `${contact.name} <${contact.email}>`),
      calendar_event_created: calendarResult.skipped ? null : !calendarResult.error,
      calendar_event_id: calendarResult.id,
    },
  });
}