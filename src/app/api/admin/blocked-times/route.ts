import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, logAudit } from "@/lib/rbac";

export async function GET(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });

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
    console.error("Blocked times GET error:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });

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
    console.error("Blocked times POST error:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });

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
    console.error("Blocked times DELETE error:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
