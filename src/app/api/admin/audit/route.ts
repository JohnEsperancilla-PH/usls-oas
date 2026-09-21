import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin } from "@/lib/rbac";

export async function GET(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });

    if (admin.role === "gate_user") {
      return NextResponse.json({ message: "Insufficient permissions" }, { status: 403 });
    }

    const supabase = createServiceClient();

    let query = supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (admin.role === "office_admin" && admin.office_id) {
      query = query.eq("office_id", admin.office_id);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json({ message: "Failed to fetch audit logs" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
