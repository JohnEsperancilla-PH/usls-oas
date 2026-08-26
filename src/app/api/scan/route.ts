import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import crypto from "crypto";

interface ScanRequest {
  token: string;
}

function verifyQRToken(token: string): { valid: boolean; appointmentId?: string } {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString());
    const { payload, signature } = decoded;
    
    const secret = process.env.QR_SECRET || "default-secret-key";
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest("hex");
    
    if (signature !== expectedSignature) {
      return { valid: false };
    }
    
    const payloadData = JSON.parse(payload);
    return { valid: true, appointmentId: payloadData.appointmentId };
  } catch {
    return { valid: false };
  }
}

export async function POST(request: Request) {
  try {
    const body: ScanRequest = await request.json();
    
    if (!body.token) {
      return NextResponse.json(
        { success: false, message: "QR code token is required" },
        { status: 400 }
      );
    }

    // Verify the QR token signature
    const { valid, appointmentId } = verifyQRToken(body.token);
    
    if (!valid || !appointmentId) {
      return NextResponse.json({
        success: false,
        message: "Invalid QR code",
      });
    }

    const supabase = createServiceClient();

    // Get the appointment
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

    // Check if appointment is approved
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

    // Check if QR code has already been used
    if (appointment.qr_used_at) {
      return NextResponse.json({
        success: false,
        message: "QR code has already been used",
      });
    }

    // Check if appointment is for today
    const today = new Date().toISOString().split("T")[0];
    if (appointment.date !== today) {
      return NextResponse.json({
        success: false,
        message: `Appointment is scheduled for ${appointment.date}`,
      });
    }

    // Mark QR code as used (atomic operation)
    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        qr_used_at: new Date().toISOString(),
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", appointment.id)
      .is("qr_used_at", null); // Ensure it hasn't been used yet

    if (updateError) {
      console.error("Error updating appointment:", updateError);
      return NextResponse.json({
        success: false,
        message: "Failed to verify QR code",
      });
    }

    // Return appointment details for verification
    return NextResponse.json({
      success: true,
      message: "QR code verified successfully",
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