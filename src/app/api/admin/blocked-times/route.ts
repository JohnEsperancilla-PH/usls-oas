import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, logAudit, requireDashboardAdmin } from "@/lib/rbac";
import { validateCsrfToken, csrfErrorResponse } from "@/lib/csrf";

// Detect a missing/uncached `blocked_times` table (PostgREST PGRST205) so admins
// get an actionable message instead of a generic 500.
function handleBlockedTimesError(err: unknown) {
  const e = err as { code?: string; message?: string } | null;
  const missingTable =
    !!e &&
    (e.code === "PGRST205" || /could not find the table 'public\.blocked_times'/i.test(e.message || ""));
  if (missingTable) {
    return NextResponse.json(
      {
        message:
          "Blocking is unavailable because the 'blocked_times' table is missing from the database. A super admin needs to run the blocked_times migration.",
      },
      { status: 503 }
    );
  }
  return handleRouteError(err);
}

export async function GET(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });
    const dashboardAccess = requireDashboardAdmin(admin);
    if (!dashboardAccess.ok) return NextResponse.json({ message: dashboardAccess.error }, { status: dashboardAccess.status });

    const { searchParams } = new URL(request.url);
    const officeId = searchParams.get("officeId");
    const month = searchParams.get("month"); // YYYY-MM

    const supabase = createServiceClient();
    let query = supabase.from("blocked_times").select("*");

    if (admin.role === "office_admin" && admin.office_id) {
      query = query.eq("office_id", admin.office_id);
    } else if (officeId) {
      query = query.eq("office_id", officeId);
    }

    if (month) {
      const [year, mon] = month.split("-").map(Number);
      const daysInMonth = new Date(year, mon, 0).getDate();
      query = query.gte("date", `${year}-${String(mon).padStart(2, "0")}-01`);
      query = query.lte("date", `${year}-${String(mon).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`);
    }

    query = query.order("date", { ascending: true });
    const { data, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    return NextResponse.json(data || []);
  } catch (err) {
    return handleBlockedTimesError(err);
  }
}

export async function POST(request: Request) {
  const csrfValid = await validateCsrfToken(request);
  if (!csrfValid) return csrfErrorResponse();

  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });
    const dashboardAccess = requireDashboardAdmin(admin);
    if (!dashboardAccess.ok) return NextResponse.json({ message: dashboardAccess.error }, { status: dashboardAccess.status });

    const body = await request.json();
    const { office_id, date, time_slot, reason } = body;

    if (!office_id || !date || !time_slot) {
      return NextResponse.json({ message: "office_id, date, and time_slot are required" }, { status: 400 });
    }

    // Office admins can only block for their own office
    if (admin.role === "office_admin" && admin.office_id !== office_id) {
      return NextResponse.json({ message: "You can only block times for your assigned office" }, { status: 403 });
    }

    const supabase = createServiceClient();

    // Check for duplicate
    const { data: existing } = await supabase
      .from("blocked_times")
      .select("id")
      .eq("office_id", office_id)
      .eq("date", date)
      .eq("time_slot", time_slot)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ message: "This time slot is already blocked" }, { status: 409 });
    }

    const { data, error: insertError } = await supabase
      .from("blocked_times")
      .insert({
        office_id,
        date,
        time_slot,
        reason: reason || null,
        created_by: admin.id,
        created_by_email: admin.email,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    await logAudit(admin.id, admin.email, "block_time", {
      office_id,
      meta: { date, time_slot, reason },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return handleBlockedTimesError(err);
  }
}

export async function DELETE(request: Request) {
  const csrfValid = await validateCsrfToken(request);
  if (!csrfValid) return csrfErrorResponse();

  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });
    const dashboardAccess = requireDashboardAdmin(admin);
    if (!dashboardAccess.ok) return NextResponse.json({ message: dashboardAccess.error }, { status: dashboardAccess.status });

    const body = await request.json();
    const { id, office_id, date, time_slot } = body;

    const supabase = createServiceClient();

    if (id) {
      // Delete by id
      const { data: record } = await supabase.from("blocked_times").select("*").eq("id", id).single();
      if (!record) return NextResponse.json({ message: "Not found" }, { status: 404 });
      if (admin.role === "office_admin" && admin.office_id !== record.office_id) {
        return NextResponse.json({ message: "Access denied" }, { status: 403 });
      }
      await supabase.from("blocked_times").delete().eq("id", id);
      await logAudit(admin.id, admin.email, "unblock_time", {
        office_id: record.office_id,
        meta: { date: record.date, time_slot: record.time_slot },
      });
    } else if (office_id && date && time_slot) {
      // Delete by composite key
      if (admin.role === "office_admin" && admin.office_id !== office_id) {
        return NextResponse.json({ message: "Access denied" }, { status: 403 });
      }
      await supabase.from("blocked_times").delete()
        .eq("office_id", office_id).eq("date", date).eq("time_slot", time_slot);
      await logAudit(admin.id, admin.email, "unblock_time", {
        office_id,
        meta: { date, time_slot },
      });
    } else {
      return NextResponse.json({ message: "Provide id or office_id/date/time_slot" }, { status: 400 });
    }

    return NextResponse.json({ message: "Unblocked" });
  } catch (err) {
    return handleBlockedTimesError(err);
  }
}
