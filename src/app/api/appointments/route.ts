import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { sendMail, generateBookingConfirmationEmail, generateAdminAlertEmail, isNotificationEnabled } from "@/lib/email";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { generateActionToken } from "@/lib/action-token";
import { isValidId } from "@/lib/valid-ids";
import { getManilaToday } from "@/lib/time";
import { mirrorAppointmentToCpanel, buildCpanelAppointment } from "@/lib/cpanel-mirror";
import type { Database } from "@/types/database";

function getPrevSlot(timeSlot: string): string | null {
  const [h, m] = timeSlot.split(":").map(Number);
  const prevM = m - 30;
  const prevH = prevM < 0 ? h - 1 : h;
  const prevMM = prevM < 0 ? 30 : prevM;
  if (prevH < 0) return null;
  return `${prevH.toString().padStart(2, "0")}:${prevMM.toString().padStart(2, "0")}`;
}

function getNextSlot(timeSlot: string): string | null {
  const [h, m] = timeSlot.split(":").map(Number);
  const nextM = m + 30;
  const nextH = nextM >= 60 ? h + 1 : h;
  const nextMM = nextM >= 60 ? nextM - 60 : nextM;
  return `${nextH.toString().padStart(2, "0")}:${nextMM.toString().padStart(2, "0")}`;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "unknown";
  const { allowed } = checkRateLimit(`booking:${ip}`, 5, 15 * 60 * 1000);
  if (!allowed) return rateLimitResponse();

  try {
    const body = await request.json();
    
    // Validate required fields
    const requiredFields = ["fullName", "phone", "email", "validId", "officeId", "personToMeet", "date", "timeSlot", "duration"];
    for (const field of requiredFields) {
      if (!body[field] || (typeof body[field] === "string" && !body[field].trim())) {
        return NextResponse.json(
          { message: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    if (!body.purposeOfVisit || !body.purposeOfVisit.trim()) {
      return NextResponse.json({ message: "Purpose of visit is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { message: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate selected valid ID
    if (!isValidId(body.validId)) {
      return NextResponse.json(
        { message: "Please select a valid government-issued ID" },
        { status: 400 }
      );
    }

    // Validate duration
    if (body.duration !== 30 && body.duration !== 60) {
      return NextResponse.json(
        { message: "Duration must be 30 or 60 minutes" },
        { status: 400 }
      );
    }

    // Input length limits
    if (body.fullName.length > 100) {
      return NextResponse.json({ message: "Name is too long (max 100 characters)" }, { status: 400 });
    }
    if (body.phone.length > 20) {
      return NextResponse.json({ message: "Phone number is too long (max 20 characters)" }, { status: 400 });
    }
    if (body.personToMeet.length > 120) {
      return NextResponse.json({ message: "Person to meet is too long (max 120 characters)" }, { status: 400 });
    }
    if (body.email.length > 254) {
      return NextResponse.json({ message: "Email is too long" }, { status: 400 });
    }
    if (body.purposeOfVisit && body.purposeOfVisit.length > 500) {
      return NextResponse.json({ message: "Purpose of visit is too long (max 500 characters)" }, { status: 400 });
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return NextResponse.json({ message: "Invalid date format" }, { status: 400 });
    }

    // Validate time slot format (HH:MM 24h, aligned to :00 or :30)
    if (!/^\d{2}:(00|30)$/.test(body.timeSlot)) {
      return NextResponse.json({ message: "Invalid time slot format" }, { status: 400 });
    }

    // Validate date is not in the past
    const todayStr = getManilaToday();
    if (body.date < todayStr) {
      return NextResponse.json({ message: "Cannot book appointments in the past" }, { status: 400 });
    }

    // Validate not a weekend
    const dayOfWeek = new Date(body.date + "T00:00:00").getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return NextResponse.json({ message: "Appointments cannot be booked on weekends" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Check if the office exists and is active
    const { data: office, error: officeError } = await supabase
      .from("offices")
      .select("*")
      .eq("id", body.officeId)
      .eq("active", true)
      .single();

    if (officeError || !office) {
      return NextResponse.json(
        { message: "Invalid or inactive office" },
        { status: 400 }
      );
    }

    // Check if this time slot (and next for 60-min) is blocked by admin
    const blockedSlots = [body.timeSlot];
    if (body.duration === 60) {
      const next = getNextSlot(body.timeSlot);
      if (next) blockedSlots.push(next);
    }

    const { data: blockedSlotsData } = await supabase
      .from("blocked_times")
      .select("id, time_slot")
      .eq("office_id", body.officeId)
      .eq("date", body.date)
      .in("time_slot", blockedSlots);

    if (blockedSlotsData && blockedSlotsData.length > 0) {
      return NextResponse.json(
        { message: "This time slot is currently unavailable. Please select another time." },
        { status: 409 }
      );
    }

    // Check for conflicting appointments (same office, date, time slot)
    // Query the requested slot + prev + next so we can detect overlapping 60-min bookings
    const slotsToQuery = new Set<string>([body.timeSlot]);
    const prev = getPrevSlot(body.timeSlot);
    if (prev) slotsToQuery.add(prev);
    const next = getNextSlot(body.timeSlot);
    if (next) slotsToQuery.add(next);

    const { data: conflictingAppointments, error: conflictError } = await supabase
      .from("appointments")
      .select("id, time_slot, duration")
      .eq("office_id", body.officeId)
      .eq("date", body.date)
      .in("time_slot", Array.from(slotsToQuery))
      .in("status", ["pending", "approved"]);

    if (conflictError) {
      console.error(conflictError);
      return NextResponse.json(
        { message: "Failed to check appointment availability" },
        { status: 500 }
      );
    }

    // Compute slot-level counts considering duration of existing bookings
    const slotCounts: Record<string, number> = {};
    for (const a of conflictingAppointments || []) {
      slotCounts[a.time_slot] = (slotCounts[a.time_slot] || 0) + 1;
      if (a.duration === 60) {
        const nextOfExisting = getNextSlot(a.time_slot);
        if (nextOfExisting) slotCounts[nextOfExisting] = (slotCounts[nextOfExisting] || 0) + 1;
      }
    }

    // Check capacity only for slots the NEW booking actually occupies
    const slotsToCheck = [body.timeSlot];
    if (body.duration === 60 && next) slotsToCheck.push(next);

    for (const slot of slotsToCheck) {
      const booked = slotCounts[slot] || 0;
      if (booked >= office.capacity_per_slot) {
        return NextResponse.json(
          { message: "This time slot is fully booked. Please select another time." },
          { status: 409 }
        );
      }
    }

    // Create the appointment in Supabase, mirroring the same row to cPanel in parallel.
    const appointmentId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const insertPayload: Database["public"]["Tables"]["appointments"]["Insert"] = {
      full_name: body.fullName,
      phone: body.phone,
      email: body.email,
      valid_id: body.validId,
      visitor_category: body.visitorCategory || "general_public",
      purpose_of_visit: body.purposeOfVisit,
      person_to_meet: body.personToMeet,
      office_id: body.officeId,
      date: body.date,
      time_slot: body.timeSlot,
      duration: body.duration,
      status: "pending",
      qr_token: null,
      qr_used_at: null,
      scanned_at: null,
      decline_reason: null,
      archived: false,
    };

    const [insertResult] = await Promise.all([
      supabase.from("appointments").insert({ id: appointmentId, ...insertPayload }).select().single(),
      mirrorAppointmentToCpanel(
        buildCpanelAppointment({
          id: appointmentId,
          full_name: body.fullName,
          phone: body.phone,
          email: body.email,
          valid_id: body.validId,
          visitor_category: body.visitorCategory || "general_public",
          purpose_of_visit: body.purposeOfVisit,
          person_to_meet: body.personToMeet,
          office_id: body.officeId,
          office_name: office.name,
          date: body.date,
          time_slot: body.timeSlot,
          duration: body.duration,
          status: "pending",
          archived: false,
          created_at: nowIso,
          updated_at: nowIso,
        })
      ),
    ]);

    const { data: appointment, error: appointmentError } = insertResult;

    if (appointmentError) {
      console.error(appointmentError);
      return NextResponse.json(
        { message: "Failed to create appointment" },
        { status: 500 }
      );
    }

    // Send confirmation email to visitor
    let confirmationResult = { success: false };
    if (await isNotificationEnabled("confirmation")) {
      const confirmationEmail = await generateBookingConfirmationEmail(
        body.fullName,
        body.date,
        body.timeSlot,
        office.name,
        body.validId,
        office.contact_email || office.email,
        office.contact_phone
      );

      confirmationResult = await sendMail({
        to: body.email,
        subject: "Appointment Confirmation - USLS OASYS",
        html: confirmationEmail.html,
        attachments: confirmationEmail.attachments,
      });
    }

    // Log the email
    await supabase.from("email_logs").insert({
      appointment_id: appointment.id,
      type: "confirmation",
      status: confirmationResult.success ? "sent" : "failed",
      sent_at: confirmationResult.success ? new Date().toISOString() : null,
      error_message: confirmationResult.success ? null : "Failed to send confirmation email",
    });

    // Send admin alert email
    if (await isNotificationEnabled("admin_alert")) {
      const origin = new URL(request.url).origin;
      const { data: admins } = await supabase
        .from("admins")
        .select("email")
        .or(`office_id.eq.${body.officeId},role.eq.super_admin`);

      const makeActionUrl = (adminEmail: string, action: "approve" | "decline") => {
        const token = generateActionToken({
          appointmentId: appointment.id,
          action,
          adminEmail,
          officeId: body.officeId,
        });
        return `${origin}/api/appointments/email-action?action=${action}&appointmentId=${appointment.id}&token=${encodeURIComponent(token)}`;
      };

      if (admins && admins.length > 0) {
        for (const admin of admins) {
          const adminEmail = await generateAdminAlertEmail(
            body.fullName,
            body.date,
            body.timeSlot,
            office.name,
            appointment.id,
            origin,
            {
              approveUrl: makeActionUrl(admin.email, "approve"),
              declineUrl: makeActionUrl(admin.email, "decline"),
            }
          );

          const adminResult = await sendMail({
            to: admin.email,
            subject: "New Appointment Request - USLS OASYS",
            html: adminEmail.html,
            attachments: adminEmail.attachments,
          });

          await supabase.from("email_logs").insert({
            appointment_id: appointment.id,
            type: "admin_alert",
            status: adminResult.success ? "sent" : "failed",
            sent_at: adminResult.success ? new Date().toISOString() : null,
            error_message: adminResult.success ? null : "Failed to send admin alert email",
          });
        }
      }

      if (office.email) {
        const officeEmail = await generateAdminAlertEmail(
          body.fullName,
          body.date,
          body.timeSlot,
          office.name,
          appointment.id,
          origin,
          {
            approveUrl: makeActionUrl(office.email, "approve"),
            declineUrl: makeActionUrl(office.email, "decline"),
          }
        );
        await sendMail({
          to: office.email,
          subject: `New Appointment - ${body.fullName} on ${body.date}`,
          html: officeEmail.html,
          attachments: officeEmail.attachments,
        });
      }
    }

    return NextResponse.json(
      {
        message: "Appointment created successfully",
        appointment: {
          id: appointment.id,
          status: appointment.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}