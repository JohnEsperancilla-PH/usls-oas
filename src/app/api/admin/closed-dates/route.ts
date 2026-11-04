import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, logAudit, requireDashboardAdmin, requireSuperAdmin } from "@/lib/rbac";
import { validateCsrfToken, csrfErrorResponse } from "@/lib/csrf";
import { getManilaToday } from "@/lib/time";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 31;

// Detect a missing `closed_dates` table (migration 047 not applied yet).
function handleClosedDatesError(err: unknown) {
  const e = err as { code?: string; message?: string } | null;
  if (e && (e.code === "PGRST205" || e.code === "42P01" || /closed_dates/i.test(e.message || ""))) {
    return NextResponse.json(
      { message: "Closed dates are unavailable because the 'closed_dates' table is missing. Run migration 047_closed_dates.sql." },
      { status: 503 }
    );
  }
  return handleRouteError(err);
}

function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(start + "T00:00:00Z");
  const last = new Date(end + "T00:00:00Z");
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export async function GET(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });
    const access = requireDashboardAdmin(admin);
    if (!access.ok) return NextResponse.json({ message: access.error }, { status: access.status });

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // YYYY-MM
    const includePast = searchParams.get("includePast") === "1";

    const supabase = createServiceClient();
    let query = supabase.from("closed_dates").select("*").order("date", { ascending: true });
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [year, mon] = month.split("-").map(Number);
      const daysInMonth = new Date(year, mon, 0).getDate();
      query = query.gte("date", `${month}-01`).lte("date", `${month}-${String(daysInMonth).padStart(2, "0")}`);
    } else if (!includePast) {
      query = query.gte("date", getManilaToday());
    }

    const { data, error: fetchError } = await query;
    if (fetchError) throw fetchError;
    return NextResponse.json(data || []);
  } catch (err) {
    return handleClosedDatesError(err);
  }
}

export async function POST(request: Request) {
  const csrfValid = await validateCsrfToken(request);
  if (!csrfValid) return csrfErrorResponse();

  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });
    const check = requireSuperAdmin(admin);
    if (!check.ok) return NextResponse.json({ message: check.error }, { status: check.status });

    const body = await request.json();
    const startDate: string = body.date;
    const endDate: string = body.endDate || body.date;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!DATE_RE.test(startDate || "") || !DATE_RE.test(endDate || "")) {
      return NextResponse.json({ message: "Pick a valid date" }, { status: 400 });
    }
    if (endDate < startDate) {
      return NextResponse.json({ message: "The end date must be on or after the start date" }, { status: 400 });
    }
    if (startDate < getManilaToday()) {
      return NextResponse.json({ message: "You can't close a date in the past" }, { status: 400 });
    }
    if (!reason) return NextResponse.json({ message: "Enter a reason, e.g. the holiday's name" }, { status: 400 });
    if (reason.length > 120) return NextResponse.json({ message: "Reason is too long (max 120 characters)" }, { status: 400 });

    const dates = datesBetween(startDate, endDate);
    if (dates.length > MAX_RANGE_DAYS) {
      return NextResponse.json({ message: `Close at most ${MAX_RANGE_DAYS} days at a time` }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: existing, error: existingError } = await supabase.from("closed_dates").select("date").in("date", dates);
    if (existingError) throw existingError;
    const alreadyClosed = new Set((existing || []).map((row) => row.date));
    const toInsert = dates.filter((d) => !alreadyClosed.has(d));
    if (toInsert.length === 0) {
      return NextResponse.json({ message: dates.length === 1 ? "This date is already closed" : "All of these dates are already closed" }, { status: 409 });
    }

    const { data, error: insertError } = await supabase
      .from("closed_dates")
      .insert(toInsert.map((date) => ({ date, reason, created_by: admin.id, created_by_email: admin.email })))
      .select();
    if (insertError) throw insertError;

    // Appointments already on these dates aren't changed; tell the admin so they can follow up.
    const { count: affectedAppointments } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .in("date", toInsert)
      .in("status", ["pending", "approved", "postponed"]);

    await logAudit(admin.id, admin.email, "close_date", {
      meta: { name: reason, start_date: toInsert[0], end_date: toInsert[toInsert.length - 1], days: toInsert.length },
    });

    return NextResponse.json({ closed: data || [], skipped: dates.length - toInsert.length, affectedAppointments: affectedAppointments || 0 }, { status: 201 });
  } catch (err) {
    return handleClosedDatesError(err);
  }
}

export async function DELETE(request: Request) {
  const csrfValid = await validateCsrfToken(request);
  if (!csrfValid) return csrfErrorResponse();

  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });
    const check = requireSuperAdmin(admin);
    if (!check.ok) return NextResponse.json({ message: check.error }, { status: check.status });

    const { id } = await request.json();
    if (!id) return NextResponse.json({ message: "id is required" }, { status: 400 });

    const supabase = createServiceClient();
    const { data: record } = await supabase.from("closed_dates").select("*").eq("id", id).maybeSingle();
    if (!record) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const { error: deleteError } = await supabase.from("closed_dates").delete().eq("id", id);
    if (deleteError) throw deleteError;

    await logAudit(admin.id, admin.email, "reopen_date", { meta: { name: record.reason, date: record.date } });
    return NextResponse.json({ message: "Reopened" });
  } catch (err) {
    return handleClosedDatesError(err);
  }
}
