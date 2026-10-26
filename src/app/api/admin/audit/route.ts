import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin } from "@/lib/rbac";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });

    if (admin.role === "gate_user") {
      return NextResponse.json({ message: "Insufficient permissions" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));
    // Characters with meaning in PostgREST filter syntax or LIKE patterns are dropped from the search text.
    const q = (searchParams.get("q") || "").replace(/[%_,()*\\]/g, " ").trim().slice(0, 100);
    const action = searchParams.get("action") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    const supabase = createServiceClient();

    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (admin.role === "office_admin" && admin.office_id) {
      query = query.eq("office_id", admin.office_id);
    }
    if (q) {
      query = query.or(`admin_email.ilike.%${q}%,target_email.ilike.%${q}%`);
    }
    if (action && /^[a-z_]+$/.test(action)) {
      query = query.eq("action", action);
    }
    // Dates are Philippine calendar days.
    if (DATE_PATTERN.test(from)) {
      query = query.gte("created_at", `${from}T00:00:00+08:00`);
    }
    if (DATE_PATTERN.test(to)) {
      query = query.lte("created_at", `${to}T23:59:59.999+08:00`);
    }

    const { data, count, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json({ message: "Failed to fetch audit logs" }, { status: 500 });
    }

    return NextResponse.json({ logs: data || [], total: count ?? 0, page, pageSize });
  } catch (error) {
    return handleRouteError(error);
  }
}
