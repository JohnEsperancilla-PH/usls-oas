import { NextResponse, after } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin } from "@/lib/rbac";
import { createUniqueReference } from "@/lib/reference";
import { runInvitationTasks, type AppointmentWithOffice } from "@/lib/appointment-actions";
import { mirrorAppointmentToCpanel, buildCpanelAppointment } from "@/lib/cpanel-mirror";
import { isValidId } from "@/lib/valid-ids";
import { getManilaToday } from "@/lib/time";
import { getAppointmentVehicles } from "@/lib/appointment-vehicles";
import { getAppointmentContacts } from "@/lib/appointment-contacts";
import type { Database } from "@/types/database";

const VISITOR_CATEGORIES = ["external", "parents", "alumni", "vendor"] as const;

export async function GET(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });
    if (admin.role === "gate_user") return NextResponse.json({ message: "Insufficient permissions" }, { status: 403 });

    const supabase = createServiceClient();

    let query = supabase
      .from("appointments")
      .select("*, offices(*)")
      .eq("is_invitation", true)
      .order("created_at", { ascending: false });

    if (admin.role === "office_admin" && admin.office_id) {
      query = query.eq("office_id", admin.office_id);
    }

    const { data, error: fetchError } = await query;
    if (fetchError) {
      console.error(fetchError);
      return NextResponse.json({ message: "Failed to fetch invitations" }, { status: 500 });
    }

    const appointments = data || [];
    const ids = appointments.map((appointment) => appointment.id);

    const { data: emailLogs } = ids.length > 0
      ? await supabase.from("email_logs").select("appointment_id, status, created_at").eq("type", "invitation").in("appointment_id", ids)
      : { data: [] as { appointment_id: string; status: string; created_at: string }[] };

    const emailSentByAppointment = new Map<string, string>();
    for (const log of emailLogs || []) {
      if (!emailSentByAppointment.has(log.appointment_id)) emailSentByAppointment.set(log.appointment_id, log.status);
    }

    const invitations = await Promise.all(
      appointments.map(async (appointment) => ({
        id: appointment.id,
        fullName: appointment.full_name,
        email: appointment.email || null,
        phone: appointment.phone || null,
        officeId: appointment.office_id,
        officeName: appointment.offices?.name || "Unknown Office",
        date: appointment.date,
        timeSlot: appointment.time_slot,
        duration: appointment.duration,
        status: appointment.status,
        referenceNumber: appointment.qr_token,
        validId: appointment.valid_id,
        visitorCategory: appointment.visitor_category,
        personToMeet: appointment.person_to_meet,
        purposeOfVisit: appointment.purpose_of_visit,
        createdAt: appointment.created_at,
        emailStatus: appointment.email ? emailSentByAppointment.get(appointment.id) || "failed" : "none",
        vehicles: (await getAppointmentVehicles(supabase, appointment.id)).map((vehicle) => ({
          plateNumber: vehicle.plate_number,
          makeModel: vehicle.make_model,
        })),
        contacts: (await getAppointmentContacts(supabase, appointment.id)).map((contact) => ({
          id: contact.contact_id,
          name: contact.name,
          email: contact.email,
          position: contact.position,
        })),
      }))
    );

    return NextResponse.json(invitations);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { admin, error: authError, status: authStatus } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: authError }, { status: authStatus });
    if (admin.role === "gate_user") return NextResponse.json({ message: "Insufficient permissions" }, { status: 403 });

    const body = await request.json();

    if (!body.fullName || typeof body.fullName !== "string" || !body.fullName.trim()) {
      return NextResponse.json({ message: "Visitor name is required" }, { status: 400 });
    }
    if (body.fullName.trim().length > 100) {
      return NextResponse.json({ message: "Name is too long (max 100 characters)" }, { status: 400 });
    }
    if (!body.officeId) {
      return NextResponse.json({ message: "Office is required" }, { status: 400 });
    }
    if (admin.role === "office_admin" && admin.office_id !== body.officeId) {
      return NextResponse.json({ message: "You can only create invitations for your office" }, { status: 403 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (email && (!emailRegex.test(email) || email.length > 254)) {
      return NextResponse.json({ message: "Invalid email format" }, { status: 400 });
    }
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    if (phone.length > 20) {
      return NextResponse.json({ message: "Phone number is too long (max 20 characters)" }, { status: 400 });
    }
    if (body.validId && !isValidId(body.validId)) {
      return NextResponse.json({ message: "Please select a valid government-issued ID" }, { status: 400 });
    }
    if (body.visitorCategory && !VISITOR_CATEGORIES.includes(body.visitorCategory)) {
      return NextResponse.json({ message: "Invalid visitor category" }, { status: 400 });
    }
    if (body.personToMeet && (typeof body.personToMeet !== "string" || body.personToMeet.length > 120)) {
      return NextResponse.json({ message: "Person to meet is too long (max 120 characters)" }, { status: 400 });
    }
    if (body.purposeOfVisit && (typeof body.purposeOfVisit !== "string" || body.purposeOfVisit.length > 500)) {
      return NextResponse.json({ message: "Purpose of visit is too long (max 500 characters)" }, { status: 400 });
    }

    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return NextResponse.json({ message: "Invalid date format" }, { status: 400 });
    }
    if (!body.timeSlot || !/^\d{2}:(00|30)$/.test(body.timeSlot)) {
      return NextResponse.json({ message: "Invalid time slot format" }, { status: 400 });
    }
    if (body.date < getManilaToday()) {
      return NextResponse.json({ message: "Cannot create invitations in the past" }, { status: 400 });
    }
    const dayOfWeek = new Date(body.date + "T00:00:00").getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return NextResponse.json({ message: "Appointments cannot be scheduled on weekends" }, { status: 400 });
    }
    const duration = body.duration === 60 ? 60 : 30;

    const vehicles = Array.isArray(body.vehicles) ? body.vehicles : [];
    if (vehicles.length > 5) {
      return NextResponse.json({ message: "Maximum of 5 vehicles allowed" }, { status: 400 });
    }
    const plateRegex = /^[A-Z0-9\s-]{3,15}$/;
    for (const vehicle of vehicles) {
      if (!vehicle || typeof vehicle.plateNumber !== "string" || !plateRegex.test(vehicle.plateNumber.trim().toUpperCase())) {
        return NextResponse.json({ message: "Each vehicle must have a valid plate number" }, { status: 400 });
      }
      if (vehicle.makeModel !== undefined && vehicle.makeModel !== null && (typeof vehicle.makeModel !== "string" || vehicle.makeModel.length > 100)) {
        return NextResponse.json({ message: "Vehicle make/model is too long (max 100 characters)" }, { status: 400 });
      }
    }

    const supabase = createServiceClient();

    const { data: office, error: officeError } = await supabase
      .from("offices")
      .select("*")
      .eq("id", body.officeId)
      .eq("active", true)
      .single();

    if (officeError || !office) {
      return NextResponse.json({ message: "Invalid or inactive office" }, { status: 400 });
    }

    const taggedContactIds = Array.isArray(body.taggedContactIds) ? body.taggedContactIds.map((id: unknown) => String(id)).filter(Boolean) : [];
    let taggedContacts: Database["public"]["Tables"]["office_contacts"]["Row"][] = [];
    if (taggedContactIds.length > 0) {
      const { data: contactRows, error: contactsError } = await supabase
        .from("office_contacts")
        .select("*")
        .in("id", taggedContactIds)
        .eq("active", true);
      if (contactsError) {
        return NextResponse.json({ message: "Failed to load tagged contacts" }, { status: 500 });
      }
      const officeContactIds = (contactRows || []).filter((contact) => contact.office_id === body.officeId);
      if (officeContactIds.length !== taggedContactIds.length) {
        return NextResponse.json({ message: "One or more tagged contacts are not part of this office" }, { status: 400 });
      }
      taggedContacts = officeContactIds;
    }

    const appointmentId = crypto.randomUUID();
    const referenceNumber = await createUniqueReference(supabase);
    const nowIso = new Date().toISOString();

    const insertPayload: Database["public"]["Tables"]["appointments"]["Insert"] = {
      full_name: body.fullName.trim(),
      phone,
      email,
      valid_id: body.validId || null,
      visitor_category: body.visitorCategory || "external",
      purpose_of_visit: typeof body.purposeOfVisit === "string" && body.purposeOfVisit.trim() ? body.purposeOfVisit.trim() : null,
      person_to_meet: typeof body.personToMeet === "string" && body.personToMeet.trim() ? body.personToMeet.trim() : null,
      office_id: body.officeId,
      date: body.date,
      time_slot: body.timeSlot,
      duration,
      visitor_count: 1,
      vehicle_count: vehicles.length,
      is_invitation: true,
      status: "approved",
      qr_token: referenceNumber,
      qr_used_at: null,
      scanned_at: null,
      decline_reason: null,
      archived: false,
    };

    const { data: appointment, error: insertError } = await supabase
      .from("appointments")
      .insert({ id: appointmentId, ...insertPayload })
      .select("*, offices(*)")
      .single();

    if (insertError || !appointment) {
      console.error(insertError);
      return NextResponse.json({ message: "Failed to create invitation" }, { status: 500 });
    }

    if (vehicles.length > 0) {
      const vehicleRows = vehicles.map((vehicle: { plateNumber: string; makeModel?: string | null }, index: number) => ({
        appointment_id: appointmentId,
        vehicle_number: index + 1,
        plate_number: vehicle.plateNumber.trim().toUpperCase(),
        make_model: typeof vehicle.makeModel === "string" && vehicle.makeModel.trim() ? vehicle.makeModel.trim() : null,
      }));
      const { error: vehiclesError } = await supabase.from("appointment_vehicles").insert(vehicleRows);
      if (vehiclesError) {
        console.error(vehiclesError);
        return NextResponse.json({ message: "Failed to save vehicle details" }, { status: 500 });
      }
    }

    if (taggedContacts.length > 0) {
      const contactRows = taggedContacts.map((contact) => ({
        appointment_id: appointmentId,
        contact_id: contact.id,
        name: contact.name,
        email: contact.email,
        position: contact.position,
      }));
      const { error: contactsError } = await supabase.from("appointment_contacts").insert(contactRows);
      if (contactsError) {
        console.error(contactsError);
        return NextResponse.json({ message: "Failed to save tagged contacts" }, { status: 500 });
      }
    }

    await mirrorAppointmentToCpanel(
      buildCpanelAppointment({
        id: appointmentId,
        full_name: appointment.full_name,
        phone: appointment.phone,
        email: appointment.email,
        valid_id: appointment.valid_id,
        visitor_category: appointment.visitor_category,
        visitor_count: 1,
        vehicle_count: vehicles.length,
        purpose_of_visit: appointment.purpose_of_visit,
        person_to_meet: appointment.person_to_meet,
        office_id: appointment.office_id,
        office_name: office.name,
        date: appointment.date,
        time_slot: appointment.time_slot,
        duration: appointment.duration,
        status: "approved",
        qr_token: referenceNumber,
        is_invitation: true,
        archived: false,
        created_at: nowIso,
        updated_at: nowIso,
      })
    );

    // Invitation email (with PDF ticket) and calendar run post-response.
    const vehiclesForTasks = await getAppointmentVehicles(supabase, appointmentId);
    const contactsForTasks = await getAppointmentContacts(supabase, appointmentId);
    const appointmentForTasks: AppointmentWithOffice = { ...appointment, vehicles: vehiclesForTasks, contacts: contactsForTasks };
    after(async () => {
      await runInvitationTasks(appointmentForTasks, referenceNumber, admin.id, admin.email);
    });

    return NextResponse.json(
      {
        message: "Invitation created successfully",
        invitation: { id: appointmentId, referenceNumber, status: "approved" },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
