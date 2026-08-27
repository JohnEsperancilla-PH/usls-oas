import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendMail, generateBookingConfirmationEmail, generateAdminAlertEmail, isNotificationEnabled } from "@/lib/email";

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

    // Check if this time slot is blocked by admin
    const { data: blocked } = await supabase
      .from("blocked_times")
      .select("id")
      .eq("office_id", body.officeId)
      .eq("date", body.date)
      .eq("time_slot", body.timeSlot)
      .maybeSingle();

    if (blocked) {
      return NextResponse.json(
        { message: "This time slot is currently unavailable. Please select another time." },
        { status: 409 }
      );
    }

    // Check for conflicting appointments (same office, date, time slot)
    const { data: conflictingAppointments, error: conflictError } = await supabase
      .from("appointments")
      .select("id")
      .eq("office_id", body.officeId)
      .eq("date", body.date)
      .eq("time_slot", body.timeSlot)
      .in("status", ["pending", "approved"]);

    if (conflictError) {
      console.error("Error checking conflicts:", conflictError);
      return NextResponse.json(
        { message: "Failed to check appointment availability" },
        { status: 500 }
      );
    }

    if (conflictingAppointments && conflictingAppointments.length >= office.capacity_per_slot) {
      return NextResponse.json(
        { message: "This time slot is fully booked. Please select another time." },
        { status: 409 }
      );
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
          appointment.id
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
        const officeEmail = await generateAdminAlertEmail(body.fullName, body.date, body.timeSlot, office.name, appointment.id);
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