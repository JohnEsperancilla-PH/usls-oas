import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin } from "@/lib/rbac";
import { getManilaToday } from "@/lib/time";
import { expireStaleAppointments } from "@/lib/expire-appointments";
import { computeAnalytics, type AnalyticsAppointment, type DecisionLog } from "@/lib/analytics";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;
const PAGE = 1000; // Supabase caps each response at 1000 rows
const APPOINTMENT_COLUMNS =
  "id, status, date, time_slot, duration, office_id, visitor_category, visitor_count, vehicle_count, is_invitation, scanned_at, checked_out_at, created_at, person_to_meet, valid_id";

function addDays(date: string, days: number) {
  const t = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });
    if (admin.role === "gate_user") {
      return NextResponse.json({ message: "Insufficient permissions" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const today = getManilaToday();
    const to = DATE_PATTERN.test(searchParams.get("to") || "") ? searchParams.get("to")! : today;
    const from = DATE_PATTERN.test(searchParams.get("from") || "") ? searchParams.get("from")! : addDays(to, -29);
    if (from > to) {
      return NextResponse.json({ message: "The start date must be on or before the end date" }, { status: 400 });
    }
    if (Date.parse(to) - Date.parse(from) > MAX_RANGE_DAYS * 86_400_000) {
      return NextResponse.json({ message: "Choose a range of one year or less" }, { status: 400 });
    }

    // Office admins only ever see their own office.
    const officeId = admin.role === "office_admin" ? admin.office_id : searchParams.get("officeId") || null;
    if (admin.role === "office_admin" && !officeId) {
      return NextResponse.json({ message: "Your account is not assigned to an office" }, { status: 403 });
    }

    await expireStaleAppointments();
    const supabase = createServiceClient();

    const appointments: AnalyticsAppointment[] = [];
    for (let offset = 0; ; offset += PAGE) {
      let query = supabase
        .from("appointments")
        .select(APPOINTMENT_COLUMNS)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (officeId) query = query.eq("office_id", officeId);
      const { data, error: fetchError } = await query;
      if (fetchError) {
        console.error(fetchError);
        return NextResponse.json({ message: "Failed to load analytics" }, { status: 500 });
      }
      appointments.push(...((data || []) as AnalyticsAppointment[]));
      if (!data || data.length < PAGE) break;
    }

    // First admin decision per appointment, for response times.
    const decisions: DecisionLog[] = [];
    const ids = appointments.filter((a) => !a.is_invitation).map((a) => a.id);
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await supabase
        .from("audit_logs")
        .select("appointment_id, action, created_at")
        .in("appointment_id", ids.slice(i, i + 200))
        .in("action", ["approve", "decline", "postpone"]);
      decisions.push(...((data || []) as DecisionLog[]));
    }

    const { data: officeRows } = await supabase.from("offices").select("id, name");
    const officeNames: Record<string, string> = {};
    (officeRows || []).forEach((o) => { officeNames[o.id] = o.name; });

    // Live: checked in today and not yet checked out, regardless of the chosen range.
    let onCampusQuery = supabase
      .from("appointments")
      .select("id, visitor_count", { count: "exact" })
      .eq("date", today)
      .not("scanned_at", "is", null)
      .is("checked_out_at", null);
    if (officeId) onCampusQuery = onCampusQuery.eq("office_id", officeId);
    const { data: onCampusRows } = await onCampusQuery;

    const result = computeAnalytics(appointments, decisions, officeNames, { from, to }, today);
    return NextResponse.json({
      ...result,
      scope: { officeId, officeName: officeId ? officeNames[officeId] || null : null },
      onCampusNow: {
        groups: onCampusRows?.length || 0,
        people: (onCampusRows || []).reduce((s, r) => s + (r.visitor_count || 1), 0),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
