import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, logAudit, requireDashboardAdmin, requireSuperAdmin } from "@/lib/rbac";
import { diffChanges } from "@/lib/audit";
import { validateCsrfToken, csrfErrorResponse } from "@/lib/csrf";
import { getManilaToday } from "@/lib/time";
import { DEFAULT_WEEKLY_REASON, WEEKDAY_NAMES, getClosedWeekdays, saveClosedWeekdays, type ClosedWeekdays } from "@/lib/closed-dates";

export async function GET(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });
    const access = requireDashboardAdmin(admin);
    if (!access.ok) return NextResponse.json({ message: access.error }, { status: access.status });

    return NextResponse.json({ weekdays: await getClosedWeekdays() });
  } catch (err) {
    return handleRouteError(err);
  }
}

// Replaces the whole set of weekly closed days: body { weekdays: { "3": "Faculty day", ... } }.
export async function PUT(request: Request) {
  const csrfValid = await validateCsrfToken(request);
  if (!csrfValid) return csrfErrorResponse();

  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });
    const check = requireSuperAdmin(admin);
    if (!check.ok) return NextResponse.json({ message: check.error }, { status: check.status });

    const body = await request.json();
    const input = body?.weekdays && typeof body.weekdays === "object" ? body.weekdays as Record<string, unknown> : null;
    if (!input) return NextResponse.json({ message: "weekdays is required" }, { status: 400 });

    const next: ClosedWeekdays = {};
    for (const [key, value] of Object.entries(input)) {
      const day = Number(key);
      if (!Number.isInteger(day) || day < 1 || day > 5) {
        return NextResponse.json({ message: "Only Monday to Friday can be closed weekly" }, { status: 400 });
      }
      const reason = typeof value === "string" ? value.trim() : "";
      if (reason.length > 120) return NextResponse.json({ message: "Reason is too long (max 120 characters)" }, { status: 400 });
      next[day] = reason || DEFAULT_WEEKLY_REASON;
    }

    const previous = await getClosedWeekdays();
    await saveClosedWeekdays(next);

    const added = Object.keys(next).map(Number).filter((d) => !(d in previous));
    const removed = Object.keys(previous).map(Number).filter((d) => !(d in next));

    // Upcoming appointments on newly closed weekdays aren't changed; tell the admin so they can follow up.
    let affectedAppointments = 0;
    if (added.length > 0) {
      const supabase = createServiceClient();
      const { data } = await supabase
        .from("appointments")
        .select("date")
        .gte("date", getManilaToday())
        .in("status", ["pending", "approved", "postponed"]);
      affectedAppointments = (data || []).filter((a) => added.includes(new Date(a.date + "T00:00:00Z").getUTCDay())).length;
    }

    // Before/after per weekday, e.g. Wednesday: "Open" → "Faculty day".
    const label = (map: ClosedWeekdays) => Object.fromEntries([1, 2, 3, 4, 5].map((d) => [WEEKDAY_NAMES[d], map[d] ?? "Open"]));
    const changes = diffChanges(label(previous), label(next));
    for (const day of added) {
      await logAudit(admin.id, admin.email, "close_date", { meta: { name: next[day], weekday: WEEKDAY_NAMES[day], recurring: "weekly", changes } });
    }
    for (const day of removed) {
      await logAudit(admin.id, admin.email, "reopen_date", { meta: { name: previous[day], weekday: WEEKDAY_NAMES[day], recurring: "weekly", changes } });
    }
    // A reason edit on an already-closed day isn't a close or reopen, but still gets recorded.
    if (added.length === 0 && removed.length === 0 && Object.keys(changes).length > 0) {
      await logAudit(admin.id, admin.email, "close_date", { meta: { name: "Weekly closed days", recurring: "weekly", changes } });
    }

    return NextResponse.json({ weekdays: next, affectedAppointments });
  } catch (err) {
    return handleRouteError(err);
  }
}
