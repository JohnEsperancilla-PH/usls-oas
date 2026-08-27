import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyQRToken } from "@/lib/qr";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

interface ScanRequest {
  token: string;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "unknown";
  const { allowed } = checkRateLimit(`scan:${ip}`, 30, 60 * 1000);
  if (!allowed) return rateLimitResponse();

  try {
    const body: ScanRequest = await request.json();
    
    if (!body.token) {
      return NextResponse.json(
        { success: false, message: "QR code token is required" },
        { status: 400 }
      );
    }

    const { valid, appointmentId } = verifyQRToken(body.token);
    
    if (!valid || !appointmentId) {
      return NextResponse.json({
        success: false,
        message: "Invalid QR code",
      });
    }

    const supabase = createServiceClient();

    const { data: appointment, error: fetchError } = await supabase
      .from("appointments")
      .select("*, offices(*)")
      .eq("id", appointmentId)
      .single();

    if (fetchError || !appointment) {
      return NextResponse.json({
        success: false,
        message: "Appointment not found",
      });
    }

    if (appointment.status !== "approved") {
      let message = "Appointment is not approved";
      if (appointment.status === "completed") {
        message = "QR code has already been used";
      } else if (appointment.status === "expired") {
        message = "Appointment has expired";
      } else if (appointment.status === "declined") {
        message = "Appointment has been declined";
      } else if (appointment.status === "pending") {
        message = "Appointment is still pending approval";
      }
      
      return NextResponse.json({
        success: false,
        message,
      });
    }

    if (appointment.qr_used_at) {
      return NextResponse.json({
        success: false,
        message: "QR code has already been used",
      });
    }

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    if (appointment.date !== today) {
      let message = `Appointment is scheduled for ${appointment.date}`;
      const apptDate = new Date(appointment.date + "T23:59:59");
      if (now > apptDate) {
        message = "QR code has expired — appointment date has passed";
      }
      return NextResponse.json({
        success: false,
        message,
      });
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
      console.error("Error updating appointment:", updateError);
      return NextResponse.json({
        success: false,
        message: "QR code has already been used",
      });
    }

    return NextResponse.json({
      success: true,
      message: "QR code verified — entry approved",
      scannedAt: scanTime,
      appointment: {
        id: appointment.id,
        fullName: appointment.full_name,
        email: appointment.email,
        phone: appointment.phone,
        office: appointment.offices?.name || "Unknown Office",
        date: appointment.date,
        timeSlot: appointment.time_slot,
        duration: appointment.duration,
        idImageUrl: appointment.id_image_url,
      },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
