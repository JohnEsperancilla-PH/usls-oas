import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, requireDashboardAdmin } from "@/lib/rbac";
import { attachAppointmentVisitors } from "@/lib/appointment-visitors";
import { attachAppointmentVehicles } from "@/lib/appointment-vehicles";
import { expireStaleAppointments } from "@/lib/expire-appointments";

export async function GET(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });
    const dashboardAccess = requireDashboardAdmin(admin);
    if (!dashboardAccess.ok) return NextResponse.json({ message: dashboardAccess.error }, { status: dashboardAccess.status });

    await expireStaleAppointments();

    const { searchParams } = new URL(request.url);
    const filterStatus = searchParams.get("status");

    const supabase = createServiceClient();

    let query = supabase
      .from("appointments")
      .select("*, offices(*)")
      .order("date", { ascending: false });

    if (admin.role === "office_admin" && admin.office_id) {
      query = query.eq("office_id", admin.office_id);
    }

    if (filterStatus === "history") {
      query = query.in("status", ["declined", "completed", "expired"]);
    } else if (filterStatus && filterStatus !== "all") {
      query = query.eq("status", filterStatus);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      console.error(fetchError);
      return NextResponse.json({ message: "Failed to fetch appointments" }, { status: 500 });
    }

    const withVisitors = await attachAppointmentVisitors(supabase, data || []);
    return NextResponse.json(await attachAppointmentVehicles(supabase, withVisitors));
  } catch (error) {
    return handleRouteError(error);
  }
}
