import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin } from "@/lib/rbac";

export async function GET(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });

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

    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
