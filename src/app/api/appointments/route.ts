import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendMail, generateBookingConfirmationEmail, generateAdminAlertEmail, isNotificationEnabled } from "@/lib/email";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

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

interface AppointmentRequest {
  fullName: string;
  phone: string;
  email: string;
  idImageUrl: string;
  visitorCategory: string;
  officeId: string;
  date: string;
  timeSlot: string;
  duration: 30 | 60;
  purposeOfVisit?: string;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "unknown";
  const { allowed } = checkRateLimit(`booking:${ip}`, 5, 15 * 60 * 1000);
  if (!allowed) return rateLimitResponse();

  try {
    const body: AppointmentRequest = await request.json();
    
    // Validate required fields
    const requiredFields = ["fullName", "phone", "email", "idImageUrl", "officeId", "date", "timeSlot", "duration"];
    for (const field of requiredFields) {
      if (!body[field as keyof AppointmentRequest]) {
        return NextResponse.json(
          { message: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { message: "Invalid email format" },
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
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
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
      console.error("Error checking conflicts:", conflictError);
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

    // Create the appointment
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .insert({
        full_name: body.fullName,
        phone: body.phone,
        email: body.email,
        id_image_url: body.idImageUrl,
        visitor_category: body.visitorCategory || "general_public",
        purpose_of_visit: body.purposeOfVisit || null,
        office_id: body.officeId,
        date: body.date,
        time_slot: body.timeSlot,
        duration: body.duration,
        status: "pending",
      })
      .select()
      .single();

    if (appointmentError) {
      console.error("Error creating appointment:", appointmentError);
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
        office.contact_email,
        office.contact_phone
      );

      confirmationResult = await sendMail({
        to: body.email,
        subject: "Appointment Confirmation - USLS OAS",
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

      if (admins && admins.length > 0) {
        const adminEmail = await generateAdminAlertEmail(
          body.fullName,
          body.date,
          body.timeSlot,
          office.name,
          appointment.id,
          origin
        );

        for (const admin of admins) {
          const adminResult = await sendMail({
            to: admin.email,
            subject: "New Appointment Request - USLS OAS",
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
        const officeEmail = await generateAdminAlertEmail(body.fullName, body.date, body.timeSlot, office.name, appointment.id, origin);
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
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}