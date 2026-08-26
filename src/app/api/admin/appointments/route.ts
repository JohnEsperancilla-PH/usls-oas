import { NextResponse } from "next/server";
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
      .order("created_at", { ascending: false });

    if (admin.role === "office_admin" && admin.office_id) {
      query = query.eq("office_id", admin.office_id);
    }

    if (filterStatus && filterStatus !== "all") {
      query = query.eq("status", filterStatus);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching appointments:", fetchError);
      return NextResponse.json({ message: "Failed to fetch appointments" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
