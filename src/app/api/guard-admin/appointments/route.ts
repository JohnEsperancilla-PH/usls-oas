import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, requireGuardAdmin } from "@/lib/rbac";
import { attachAppointmentVisitors } from "@/lib/appointment-visitors";
import { attachAppointmentVehicles } from "@/lib/appointment-vehicles";
import { expireStaleAppointments } from "@/lib/expire-appointments";
import { getManilaToday } from "@/lib/time";

// Read-only: every office's appointments for one day (today by default), for guard admins.
export async function GET(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });
    const access = requireGuardAdmin(admin);
    if (!access.ok) return NextResponse.json({ message: access.error }, { status: access.status });

    await expireStaleAppointments();

    const { searchParams } = new URL(request.url);
    const requested = searchParams.get("date");
    const date = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : getManilaToday();

    const supabase = createServiceClient();
    const { data, error: fetchError } = await supabase
      .from("appointments")
      .select("*, offices(*)")
      .eq("date", date)
      .order("time_slot", { ascending: true, nullsFirst: false });

    if (fetchError) {
      console.error(fetchError);
      return NextResponse.json({ message: "Failed to fetch appointments" }, { status: 500 });
    }

    const withVisitors = await attachAppointmentVisitors(supabase, data || []);
    return NextResponse.json({ date, appointments: await attachAppointmentVehicles(supabase, withVisitors) });
  } catch (error) {
    return handleRouteError(error);
  }
}
