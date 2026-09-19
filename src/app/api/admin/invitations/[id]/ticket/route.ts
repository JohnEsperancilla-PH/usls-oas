import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin } from "@/lib/rbac";
import { generateTicketPdf } from "@/lib/ticket";
import { getAppointmentVehicles } from "@/lib/appointment-vehicles";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });
    if (admin.role === "gate_user") return NextResponse.json({ message: "Insufficient permissions" }, { status: 403 });

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
    if (admin.role === "office_admin" && admin.office_id !== appointment.office_id) {
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
