import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, requireSuperAdmin } from "@/lib/rbac";

export async function GET(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });

    const check = requireSuperAdmin(admin);
    if (!check.ok) return NextResponse.json({ message: check.error }, { status: check.status });

    const supabase = createServiceClient();

    const { data, error: fetchError } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (fetchError) {
      return NextResponse.json({ message: "Failed to fetch audit logs" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Audit logs GET error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
