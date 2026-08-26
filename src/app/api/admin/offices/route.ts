import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, requireSuperAdmin, logAudit } from "@/lib/rbac";

export async function GET(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });

    const supabase = createServiceClient();

    let query = supabase.from("offices").select("*").order("name");

    if (admin.role === "office_admin" && admin.office_id) {
      query = query.eq("id", admin.office_id);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json({ message: "Failed to fetch offices" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Offices GET error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });

    const check = requireSuperAdmin(admin);
    if (!check.ok) return NextResponse.json({ message: check.error }, { status: check.status });

    const body = await request.json();
    const { name, email, description, operating_hours, capacity_per_slot } = body;

    if (!name || !operating_hours) {
      return NextResponse.json({ message: "Name and operating hours are required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data, error: insertError } = await supabase
      .from("offices")
      .insert({
        name,
        email: email || null,
        description: description || null,
        operating_hours,
        capacity_per_slot: capacity_per_slot || 1,
        active: true,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ message: "Failed to create office" }, { status: 500 });
    }

    await logAudit(admin.id, admin.email, "create_office", { office_id: data.id, meta: { name } });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Offices POST error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });

    const check = requireSuperAdmin(admin);
    if (!check.ok) return NextResponse.json({ message: check.error }, { status: check.status });

    const body = await request.json();
    const { id, name, email, description, operating_hours, capacity_per_slot, active } = body;

    if (!id) {
      return NextResponse.json({ message: "Office ID is required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (description !== undefined) updateData.description = description;
    if (operating_hours !== undefined) updateData.operating_hours = operating_hours;
    if (capacity_per_slot !== undefined) updateData.capacity_per_slot = capacity_per_slot;
    if (active !== undefined) updateData.active = active;

    const { error: updateError } = await supabase
      .from("offices")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ message: "Failed to update office" }, { status: 500 });
    }

    await logAudit(admin.id, admin.email, "update_office", { office_id: id, meta: updateData });

    return NextResponse.json({ message: "Office updated" });
  } catch (error) {
    console.error("Offices PUT error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });

    const check = requireSuperAdmin(admin);
    if (!check.ok) return NextResponse.json({ message: check.error }, { status: check.status });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ message: "Office ID is required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { error: deleteError } = await supabase
      .from("offices")
      .update({ active: false })
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json({ message: "Failed to deactivate office" }, { status: 500 });
    }

    await logAudit(admin.id, admin.email, "delete_office", { office_id: id });

    return NextResponse.json({ message: "Office deactivated" });
  } catch (error) {
    console.error("Offices DELETE error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
