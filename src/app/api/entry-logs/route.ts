import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, requireGuardAdmin } from "@/lib/rbac";
import { getManilaToday } from "@/lib/time";
import type { EntryLogEvent } from "@/types/database";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EVENTS: EntryLogEvent[] = ["entry", "checkout", "denied", "rejected"];
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

// Gate entry log for super admins and guard admins. Dates are Philippine dates; default is today.
export async function GET(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });
    const access = requireGuardAdmin(admin);
    if (!access.ok) return NextResponse.json({ message: access.error }, { status: access.status });

    const { searchParams } = new URL(request.url);
    const today = getManilaToday();
    const from = DATE_PATTERN.test(searchParams.get("from") || "") ? searchParams.get("from")! : today;
    const to = DATE_PATTERN.test(searchParams.get("to") || "") ? searchParams.get("to")! : from;
    const eventParam = searchParams.get("event") as EntryLogEvent | null;
    const event = eventParam && EVENTS.includes(eventParam) ? eventParam : null;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));
    // Characters with meaning in PostgREST filter syntax or LIKE patterns are dropped from the search text.
    const q = (searchParams.get("q") || "").replace(/[%_,()*\\]/g, " ").trim().slice(0, 100);

    const startIso = new Date(`${from}T00:00:00+08:00`).toISOString();
    const endIso = new Date(`${to}T23:59:59.999+08:00`).toISOString();
    const searchFilter = q
      ? ["visitor_name", "guard_name", "guard_username", "reference", "office_name", "vehicle_plates"].map((col) => `${col}.ilike.%${q}%`).join(",")
      : null;

    const supabase = createServiceClient();
    const base = () => {
      let query = supabase.from("entry_logs").select("*", { count: "exact" }).gte("created_at", startIso).lte("created_at", endIso);
      if (searchFilter) query = query.or(searchFilter);
      return query;
    };

    let listQuery = base().order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
    if (event) listQuery = listQuery.eq("event", event);

    const [list, ...counts] = await Promise.all([
      listQuery,
      ...EVENTS.map((e) => base().eq("event", e).limit(0)),
    ]);

    if (list.error) {
      const missing = list.error.code === "PGRST205" || /entry_logs/i.test(list.error.message || "");
      return NextResponse.json(
        { message: missing ? "Entry logs aren't set up yet. Run migration 050_entry_logs.sql." : "Failed to load entry logs" },
        { status: missing ? 503 : 500 }
      );
    }

    return NextResponse.json({
      from,
      to,
      logs: list.data || [],
      total: list.count || 0,
      summary: Object.fromEntries(EVENTS.map((e, i) => [e, counts[i].count || 0])),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
