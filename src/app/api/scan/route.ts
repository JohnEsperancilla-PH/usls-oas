import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizeReference } from "@/lib/reference";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { mirrorAppointmentToCpanel, fromAppointmentRow } from "@/lib/cpanel-mirror";
import { getAuthAdmin, requireEntryUser, logAudit } from "@/lib/rbac";
import { getManilaToday } from "@/lib/time";
import type { Appointment } from "@/types/database";

type ScanReason = "preview" | "not_found" | "pending" | "cancelled" | "expired" | "wrong_date" | "already_used" | "duplicate_scan" | "invalid_id" | "checked_out" | "entry_denied";

function scanFailure(message: string, reason: ScanReason, appointment?: Record<string, unknown>, status = 200) {
  return NextResponse.json({ success: false, reason, message, ...(appointment ? { appointment } : {}) }, { status });
}

function appointmentSummary(appointment: Appointment & { offices?: { name?: string | null } | null }) {
  return {
    id: appointment.id,
    fullName: appointment.full_name,
    email: appointment.email,
    phone: appointment.phone,
    visitorCategory: appointment.visitor_category,
    office: appointment.offices?.name || "Unknown Office",
    personToMeet: appointment.person_to_meet || "",
    purposeOfVisit: appointment.purpose_of_visit || "",
    date: appointment.date,
    timeSlot: appointment.time_slot,
    duration: appointment.duration,
    validId: appointment.valid_id || "",
    referenceNumber: appointment.qr_token || "",
    status: appointment.status,
    scannedAt: appointment.scanned_at,
    checkedOutAt: appointment.checked_out_at,
  };
}

export async function GET(request: Request) {
  const { admin, error, status } = await getAuthAdmin(request);
  if (!admin) return NextResponse.json({ message: error }, { status });
  const access = requireEntryUser(admin);
  if (!access.ok) return NextResponse.json({ message: access.error }, { status: access.status });

  const supabase = createServiceClient();
  const today = getManilaToday();
  let query = supabase
    .from("appointments")
    .select("*, offices(name)")
    .eq("date", today)
    .in("status", ["approved", "completed"])
    .order("time_slot", { ascending: true });

  if (admin.role === "gate_user" && admin.office_id) query = query.eq("office_id", admin.office_id);

  const { data, error: fetchError } = await query;
  if (fetchError) return NextResponse.json({ message: "Failed to load today's visitors" }, { status: 500 });

  return NextResponse.json({
    date: today,
    visitors: (data || []).map((appointment) => ({
      ...appointmentSummary(appointment),
      status: appointment.status,
    })),
  });
}

export async function POST(request: Request) {
  const { admin, error, status } = await getAuthAdmin(request);
  if (!admin) return NextResponse.json({ success: false, message: error }, { status });
  const access = requireEntryUser(admin);
  if (!access.ok) return NextResponse.json({ success: false, message: access.error }, { status: access.status });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "unknown";
  const { allowed } = checkRateLimit(`scan:${ip}`, 30, 60 * 1000);
  if (!allowed) return rateLimitResponse();

  try {
    const body = await request.json();

    const reference = normalizeReference(body.token || "");
    const action = body.action === "checkout" ? "checkout" : body.action === "deny_entry" ? "deny_entry" : body.action === "allow_entry" ? "allow_entry" : "preview";

    if (!reference) {
      return NextResponse.json(
        { success: false, message: "Reference number is required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    const { data: appointment, error: fetchError } = await supabase
      .from("appointments")
      .select("*, offices(*)")
      .eq("qr_token", reference)
      .maybeSingle();

    if (fetchError || !appointment) {
      return scanFailure("Reference number not found", "not_found", undefined, 404);
    }

    const summary = appointmentSummary(appointment);

    if (action === "deny_entry") {
      if (appointment.status !== "approved") return scanFailure("Only an approved appointment can be denied at the gate", "already_used", summary, 409);
      if (typeof body.reason !== "string" || !body.reason.trim()) return scanFailure("A reason is required when denying entry", "entry_denied", summary, 400);
      const denialTime = new Date().toISOString();
      const denialReason = body.reason.trim().slice(0, 500);
      const { data: denied, error: denialError } = await supabase
        .from("appointments")
        .update({ status: "entry_denied", decline_reason: denialReason, updated_at: denialTime })
        .eq("id", appointment.id)
        .eq("status", "approved")
        .select()
        .maybeSingle();
      if (denialError || !denied) return scanFailure("This appointment was already processed", "already_used", summary, 409);
      await mirrorAppointmentToCpanel(fromAppointmentRow(appointment, { status: "entry_denied", decline_reason: denialReason, updated_at: denialTime }));
      await logAudit(admin.id, admin.email, "entry_denied", {
        appointment_id: appointment.id,
        office_id: appointment.office_id,
        meta: { visitor_name: appointment.full_name, reference_number: reference, reason: denialReason },
      });
      return scanFailure(denialReason, "entry_denied", { ...summary, status: "entry_denied" }, 409);
    }

    if (action === "checkout") {
      if (appointment.status !== "completed") return scanFailure("Visitor has not been checked in", "pending", summary, 409);
      if (appointment.checked_out_at) return scanFailure("Visitor has already been checked out", "checked_out", summary, 409);
      const checkoutTime = new Date().toISOString();
      const { data: checkedOut, error: checkoutError } = await supabase
        .from("appointments")
        .update({ checked_out_at: checkoutTime, updated_at: checkoutTime })
        .eq("id", appointment.id)
        .eq("status", "completed")
        .is("checked_out_at", null)
        .select()
        .maybeSingle();
      if (checkoutError || !checkedOut) return scanFailure("Visitor was already checked out", "checked_out", summary, 409);
      await mirrorAppointmentToCpanel(fromAppointmentRow(appointment, { checked_out_at: checkoutTime, updated_at: checkoutTime }));
      await logAudit(admin.id, admin.email, "checkout", {
        appointment_id: appointment.id,
        office_id: appointment.office_id,
        meta: { visitor_name: appointment.full_name, reference_number: reference, checked_out_at: checkoutTime },
      });
      return NextResponse.json({ success: true, reason: "checked_out", message: "Visitor checkout recorded", checkedOutAt: checkoutTime, appointment: { ...summary, checkedOutAt: checkoutTime } });
    }

    if (appointment.status !== "approved") {
      let message = "Appointment is not approved";
      if (appointment.status === "completed") {
        message = "Reference number has already been used";
      } else if (appointment.status === "entry_denied") {
        message = appointment.decline_reason || "Entry was denied at the gate";
      } else if (appointment.status === "expired") {
        message = "Appointment has expired";
      } else if (appointment.status === "declined") {
        message = "Appointment has been declined";
      } else if (appointment.status === "pending") {
        message = "Appointment is still pending approval";
      }
      
      const reason: ScanReason = appointment.status === "declined" ? "cancelled" : appointment.status === "expired" ? "expired" : appointment.status === "pending" ? "pending" : "already_used";
      return scanFailure(message, reason, summary, 409);
    }

    if (appointment.qr_used_at) {
      return scanFailure("Reference number has already been used", "already_used", summary, 409);
    }

    if (action === "preview") {
      return NextResponse.json({
        success: true,
        reason: "preview",
        message: "Appointment found — confirm entry or deny access",
        appointment: summary,
      });
    }

    const now = new Date();
    const today = getManilaToday();
    if (appointment.date !== today) {
      let message = `Appointment is scheduled for ${appointment.date}`;
      if (appointment.date < today) {
        message = "Reference number has expired — appointment date has passed";
        return scanFailure(message, "expired", summary, 409);
      }
      return scanFailure(message, "wrong_date", summary, 409);
    }

    if (body.idVerified === false) {
      return scanFailure("The visitor's ID does not match the appointment", "invalid_id", summary, 409);
    }

    const scanTime = now.toISOString();
    const { error: updateError, data: updated } = await supabase
      .from("appointments")
      .update({
        qr_used_at: scanTime,
        scanned_at: scanTime,
        status: "completed",
        updated_at: scanTime,
      })
      .eq("id", appointment.id)
      .is("qr_used_at", null)
      .select()
      .single();

    if (updateError || !updated) {
      console.error(updateError);
      return scanFailure("This reference was scanned moments ago and is already in use", "duplicate_scan", summary, 409);
    }

    await mirrorAppointmentToCpanel(
      fromAppointmentRow(appointment, {
        status: "completed",
        qr_used_at: scanTime,
        scanned_at: scanTime,
        updated_at: scanTime,
      })
    );

    await logAudit(admin.id, admin.email, "entry", {
      appointment_id: appointment.id,
      office_id: appointment.office_id,
      meta: {
        guard_name: admin.name,
        guard_employee_id: admin.employee_id,
        reference_number: reference,
        visitor_name: appointment.full_name,
        visitor_email: appointment.email,
        office_name: appointment.offices?.name || "Unknown Office",
        scanned_at: scanTime,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Reference number verified — entry approved",
      scannedAt: scanTime,
      reason: "approved",
      appointment: {
        id: appointment.id,
        fullName: appointment.full_name,
        email: appointment.email,
        phone: appointment.phone,
        visitorCategory: appointment.visitor_category,
        office: appointment.offices?.name || "Unknown Office",
        personToMeet: appointment.person_to_meet || "",
        purposeOfVisit: appointment.purpose_of_visit || "",
        date: appointment.date,
        timeSlot: appointment.time_slot,
        duration: appointment.duration,
        validId: appointment.valid_id || "",
        referenceNumber: reference,
        status: "completed",
        scannedAt: scanTime,
        checkedOutAt: null,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
