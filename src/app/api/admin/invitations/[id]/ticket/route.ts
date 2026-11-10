import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, isDashboardRole, logAudit } from "@/lib/rbac";
import { clientInfo } from "@/lib/sign-in-log";
import { generateTicketPdf } from "@/lib/ticket";
import { getAppointmentVehicles } from "@/lib/appointment-vehicles";
import { canAccessAppointment } from "@/lib/office-scope";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });
    if (!isDashboardRole(admin.role)) return NextResponse.json({ message: "Insufficient permissions" }, { status: 403 });

    const supabase = createServiceClient();

    const { data: appointment, error: fetchError } = await supabase
      .from("appointments")
      .select("*, offices(*)")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !appointment) {
      return NextResponse.json({ message: "Invitation not found" }, { status: 404 });
    }
    if (!appointment.is_invitation) {
      return NextResponse.json({ message: "Appointment is not an invitation" }, { status: 400 });
    }
    if (admin.role === "office_admin" && admin.office_id !== appointment.invited_by_office_id && !(await canAccessAppointment(admin, appointment))) {
      return NextResponse.json({ message: "You can only access invitations for your office" }, { status: 403 });
    }
    if (!appointment.qr_token) {
      return NextResponse.json({ message: "Invitation has no reference number" }, { status: 409 });
    }

    const vehicles = await getAppointmentVehicles(supabase, appointment.id);
    const pdf = await generateTicketPdf({
      referenceNumber: appointment.qr_token,
      visitorName: appointment.full_name,
      officeName: appointment.offices?.name || "Unknown Office",
      date: appointment.date,
      timeSlot: appointment.time_slot,
      duration: appointment.duration,
      validId: appointment.valid_id,
      personToMeet: appointment.person_to_meet,
      purpose: appointment.purpose_of_visit,
      vehicles: vehicles.map((vehicle) => ({ plateNumber: vehicle.plate_number, makeModel: vehicle.make_model })),
    });

    // The ticket carries the visitor's personal data and gate pass, so each download is recorded.
    await logAudit(admin.id, admin.email, "download_ticket", {
      appointment_id: appointment.id,
      office_id: appointment.office_id,
      target_email: appointment.email || undefined,
      meta: { visitor_name: appointment.full_name, office_name: appointment.offices?.name || null, date: appointment.date, ...clientInfo(request) },
    });

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="USLS-OASYS-Ticket-${appointment.qr_token}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
