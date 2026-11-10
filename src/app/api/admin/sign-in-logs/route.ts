import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, requireSuperAdmin } from "@/lib/rbac";
import { getManilaToday } from "@/lib/time";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PAGE_SIZE_MAX = 100;
// An account with this many failed attempts in the period is flagged.
const REPEATED_FAILURES = 3;

// Sign-in attempts on the admin and gate login pages, for super admins.
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
    const portal = searchParams.get("portal");
    const outcome = searchParams.get("outcome"); // success | failed
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, parseInt(searchParams.get("pageSize") || "25", 10) || 25));
    const q = (searchParams.get("q") || "").replace(/[%_,()*\\]/g, " ").trim().slice(0, 100);

    const startIso = new Date(`${from}T00:00:00+08:00`).toISOString();
    const endIso = new Date(`${to}T23:59:59.999+08:00`).toISOString();
    const supabase = createServiceClient();
    const inRange = <T extends { gte: (c: string, v: string) => T; lte: (c: string, v: string) => T }>(query: T) => query.gte("created_at", startIso).lte("created_at", endIso);

    let list = inRange(supabase.from("sign_in_logs").select("*", { count: "exact" }));
    if (portal === "admin" || portal === "gate") list = list.eq("portal", portal);
    if (outcome === "success") list = list.eq("success", true);
    if (outcome === "failed") list = list.eq("success", false);
    if (q) list = list.or(["identifier", "name", "ip"].map((col) => `${col}.ilike.%${q}%`).join(","));

    const [rows, successCount, failedRows] = await Promise.all([
      list.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1),
      inRange(supabase.from("sign_in_logs").select("id", { count: "exact", head: true })).eq("success", true),
      inRange(supabase.from("sign_in_logs").select("identifier, portal, created_at")).eq("success", false).limit(2000),
    ]);

    if (rows.error) {
      const missing = rows.error.code === "PGRST205" || /sign_in_logs/i.test(rows.error.message || "");
      return NextResponse.json(
        { message: missing ? "Sign-in logs aren't set up yet. Run migration 051_activity_logs.sql." : "Failed to load sign-in logs" },
        { status: missing ? 503 : 500 }
      );
    }

    // Accounts (or typed names) with repeated failures in the period, most first.
    const failures = new Map<string, { identifier: string; portal: string; count: number; last: string }>();
    for (const row of failedRows.data || []) {
      const key = `${row.portal}:${(row.identifier || "").toLowerCase()}`;
      const entry = failures.get(key) || { identifier: row.identifier || "(blank)", portal: row.portal, count: 0, last: row.created_at };
      entry.count++;
      if (row.created_at > entry.last) entry.last = row.created_at;
      failures.set(key, entry);
    }
    const flagged = [...failures.values()].filter((f) => f.count >= REPEATED_FAILURES).sort((a, b) => b.count - a.count).slice(0, 10);

    return NextResponse.json({
      logs: rows.data || [],
      total: rows.count || 0,
      summary: { success: successCount.count || 0, failed: (failedRows.data || []).length },
      flagged,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
