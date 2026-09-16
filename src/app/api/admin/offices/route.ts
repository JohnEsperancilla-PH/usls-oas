import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
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
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });

    const check = requireSuperAdmin(admin);
    if (!check.ok) return NextResponse.json({ message: check.error }, { status: check.status });

    const body = await request.json();
    const { name, email, description, operating_hours, capacity_per_slot, contact_email, contact_phone, category } = body;

    if (!name) {
      return NextResponse.json({ message: "Office name is required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data, error: insertError } = await supabase
      .from("offices")
      .insert({
        name,
        email: email || null,
        description: description || null,
        operating_hours: operating_hours || "8:00 AM - 5:00 PM",
        capacity_per_slot: capacity_per_slot || 1,
        contact_email: contact_email || null,
        contact_phone: contact_phone || null,
        category: category || null,
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
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });

    const check = requireSuperAdmin(admin);
    if (!check.ok) return NextResponse.json({ message: check.error }, { status: check.status });

    const body = await request.json();
    const { id, name, email, description, operating_hours, capacity_per_slot, active, contact_email, contact_phone, category } = body;

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
    if (contact_email !== undefined) updateData.contact_email = contact_email;
    if (contact_phone !== undefined) updateData.contact_phone = contact_phone;
    if (category !== undefined) updateData.category = category;

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
    return handleRouteError(error);
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
    return handleRouteError(error);
  }
}
