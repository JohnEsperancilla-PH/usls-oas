import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, requireSuperAdmin } from "@/lib/rbac";
import { getManilaToday } from "@/lib/time";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ["sent", "failed", "pending"] as const;

// Delivery record of every system email (confirmation, approval, invitation…), for super admins.
// The recipient isn't stored, so it's read from the appointment: the office for admin alerts, else the visitor.
export async function GET(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });
    const access = requireSuperAdmin(admin);
    if (!access.ok) return NextResponse.json({ message: access.error }, { status: access.status });

    const { searchParams } = new URL(request.url);
    const today = getManilaToday();
    const from = DATE_PATTERN.test(searchParams.get("from") || "") ? searchParams.get("from")! : today;
    const to = DATE_PATTERN.test(searchParams.get("to") || "") ? searchParams.get("to")! : from;
    const statusFilter = STATUSES.find((s) => s === searchParams.get("status")) || null;
    const type = (searchParams.get("type") || "").replace(/[^a-z_]/g, "");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "25", 10) || 25));
    const q = (searchParams.get("q") || "").replace(/[%_,()*\\]/g, " ").trim().slice(0, 100);

    const startIso = new Date(`${from}T00:00:00+08:00`).toISOString();
    const endIso = new Date(`${to}T23:59:59.999+08:00`).toISOString();
    const supabase = createServiceClient();
    // !inner so a visitor search filters the email rows, not just the embedded appointment.
    const embed = `appointments${q ? "!inner" : ""}(id, full_name, email, date, time_slot, status, office_id, offices(name, email, contact_email))`;

    let list = supabase.from("email_logs").select(`*, ${embed}`, { count: "exact" }).gte("created_at", startIso).lte("created_at", endIso);
    if (statusFilter) list = list.eq("status", statusFilter);
    if (type) list = list.eq("type", type);
    if (q) list = list.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`, { referencedTable: "appointments" });

    const [rows, ...counts] = await Promise.all([
      list.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1),
      ...STATUSES.map((s) => supabase.from("email_logs").select("id", { count: "exact", head: true }).gte("created_at", startIso).lte("created_at", endIso).eq("status", s)),
    ]);

    if (rows.error) {
      console.error(rows.error);
      return NextResponse.json({ message: "Failed to load email logs" }, { status: 500 });
    }

    return NextResponse.json({
      logs: rows.data || [],
      total: rows.count || 0,
      summary: Object.fromEntries(STATUSES.map((s, i) => [s, counts[i].count || 0])),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
