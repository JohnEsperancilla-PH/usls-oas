import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, requireSuperAdmin, logAudit } from "@/lib/rbac";
import { validateCsrfToken, csrfErrorResponse } from "@/lib/csrf";
import { getOfficeDeleteCheck } from "@/lib/office-delete";
import { validateOfficeSettings } from "@/lib/office-settings";

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

    if (!data || data.length === 0) {
      return NextResponse.json([]);
    }

    const officeIds = data.map((office: { id: string }) => office.id);
    const { data: contacts, error: contactsError } = await supabase
      .from("office_contacts")
      .select("*")
      .eq("active", true)
      .in("office_id", officeIds)
      .order("name");

    if (contactsError) {
      console.error(contactsError);
    }

    const officesWithContacts = data.map((office: { id: string }) => ({
      ...office,
      contacts: (contacts || []).filter((contact: { office_id: string }) => contact.office_id === office.id),
    }));

    return NextResponse.json(officesWithContacts);
  } catch (error) {
    return handleRouteError(error);
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
    const { name, email, description, operating_hours, capacity_per_slot, contact_email, contact_phone, category, hide_time_slots, can_invite_for_other_offices } = body;

    if (!name) {
      return NextResponse.json({ message: "Office name is required" }, { status: 400 });
    }

    const limits = validateOfficeSettings({ max_advance_days: body.max_advance_days, min_notice_hours: body.min_notice_hours });
    if ("error" in limits) return NextResponse.json({ message: limits.error }, { status: 400 });

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
        hide_time_slots: hide_time_slots || false,
        can_invite_for_other_offices: can_invite_for_other_offices === true,
        ...limits.updates,
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
  const csrfValid = await validateCsrfToken(request);
  if (!csrfValid) return csrfErrorResponse();

  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });

    const check = requireSuperAdmin(admin);
    if (!check.ok) return NextResponse.json({ message: check.error }, { status: check.status });

    const body = await request.json();
    const { id, name, email, description, operating_hours, capacity_per_slot, active, contact_email, contact_phone, category, hide_time_slots, can_invite_for_other_offices } = body;

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
    if (hide_time_slots !== undefined) updateData.hide_time_slots = hide_time_slots;
    if (can_invite_for_other_offices !== undefined) updateData.can_invite_for_other_offices = can_invite_for_other_offices === true;
    const limits = validateOfficeSettings(Object.fromEntries(["max_advance_days", "min_notice_hours"].filter((key) => key in body).map((key) => [key, body[key]])));
    if ("error" in limits) return NextResponse.json({ message: limits.error }, { status: 400 });
    Object.assign(updateData, limits.updates);

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
  const csrfValid = await validateCsrfToken(request);
  if (!csrfValid) return csrfErrorResponse();

  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });

    const check = requireSuperAdmin(admin);
    if (!check.ok) return NextResponse.json({ message: check.error }, { status: check.status });

    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) {
      return NextResponse.json({ message: "Office ID is required" }, { status: 400 });
    }

    const usage = await getOfficeDeleteCheck(id);
    if (!usage) return NextResponse.json({ message: "Office not found" }, { status: 404 });
    if (usage.blockers.length > 0) {
      return NextResponse.json({ message: usage.blockers.join(" ") }, { status: 409 });
    }
    if (typeof body.confirmName !== "string" || body.confirmName.trim() !== usage.name.trim()) {
      return NextResponse.json({ message: "Type the office name exactly to confirm" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // The database deletes the office's appointments, contacts, and blocked times with it.
    const { error: deleteError } = await supabase
      .from("offices")
      .delete()
      .eq("id", id)
      .eq("active", false);

    if (deleteError) {
      console.error(deleteError);
      return NextResponse.json({ message: "Failed to delete office" }, { status: 500 });
    }

    // The office row is gone, so its id goes in the details rather than the office_id reference.
    await logAudit(admin.id, admin.email, "permanently_delete_office", {
      meta: { name: usage.name, deleted_office_id: id, appointments_deleted: usage.totalAppointments },
    });

    return NextResponse.json({ message: "Office deleted" });
  } catch (error) {
    return handleRouteError(error);
  }
}
