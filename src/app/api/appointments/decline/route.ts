import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, logAudit } from "@/lib/rbac";
import { sendMail, generateDeclineEmail } from "@/lib/email";

interface DeclineRequest {
  appointmentId: string;
  reason?: string;
}

export async function POST(request: Request) {
  try {
    const { admin, error: authError, status: authStatus } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: authError }, { status: authStatus });

    const body: DeclineRequest = await request.json();
    
    if (!body.appointmentId) {
      return NextResponse.json({ message: "Appointment ID is required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: appointment, error: fetchError } = await supabase
      .from("appointments")
      .select("*, offices(*)")
      .eq("id", body.appointmentId)
      .single();

    if (fetchError || !appointment) {
      return NextResponse.json({ message: "Appointment not found" }, { status: 404 });
    }

    if (admin.role === "office_admin" && admin.office_id !== appointment.office_id) {
      return NextResponse.json({ message: "You can only decline appointments for your office" }, { status: 403 });
    }

    if (appointment.status !== "pending") {
      return NextResponse.json({ message: "Appointment is not in pending status" }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        status: "declined",
        decline_reason: body.reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appointment.id);

    if (updateError) {
      return NextResponse.json({ message: "Failed to update appointment" }, { status: 500 });
    }

    const emailContent = generateDeclineEmail(
      appointment.full_name,
      appointment.date,
      appointment.time_slot,
      appointment.offices?.name || "Unknown Office",
      body.reason
    );

    const emailResult = await sendMail({
      to: appointment.email,
      subject: "Appointment Declined - USLS OAS",
      html: emailContent.html,
      attachments: emailContent.attachments,
    });

    await supabase.from("email_logs").insert({
      appointment_id: appointment.id,
      type: "decline",
      status: emailResult.success ? "sent" : "failed",
      sent_at: emailResult.success ? new Date().toISOString() : null,
      error_message: emailResult.success ? null : "Failed to send decline email",
    });

    await logAudit(admin.id, admin.email, "decline", {
      appointment_id: appointment.id,
      meta: { visitor_name: appointment.full_name, reason: body.reason },
    });

    return NextResponse.json({
      message: "Appointment declined successfully",
      appointment: { id: appointment.id, status: "declined" },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
