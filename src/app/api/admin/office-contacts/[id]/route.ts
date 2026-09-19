import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, logAudit } from "@/lib/rbac";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });
    if (admin.role === "gate_user") return NextResponse.json({ message: "Insufficient permissions" }, { status: 403 });

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const email = typeof body.email === "string" ? body.email.trim() : undefined;
    const position = typeof body.position === "string" ? body.position.trim() : undefined;

    if (name !== undefined && (name.length === 0 || name.length > 255)) {
      return NextResponse.json({ message: "Contact name is invalid (max 255 characters)" }, { status: 400 });
    }
    if (email !== undefined && (!emailRegex.test(email) || email.length > 254)) {
      return NextResponse.json({ message: "Invalid contact email" }, { status: 400 });
    }
    if (position !== undefined && position.length > 255) {
      return NextResponse.json({ message: "Position is too long (max 255 characters)" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: contact } = await supabase.from("office_contacts").select("*").eq("id", id).single();
    if (!contact) return NextResponse.json({ message: "Contact not found" }, { status: 404 });

    if (admin.role === "office_admin" && contact.office_id !== admin.office_id) {
      return NextResponse.json({ message: "You can only update contacts for your office" }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (position !== undefined) updateData.position = position;

    const { error: updateError } = await supabase.from("office_contacts").update(updateData).eq("id", id);
    if (updateError) {
      return NextResponse.json({ message: "Failed to update contact" }, { status: 500 });
    }

    await logAudit(admin.id, admin.email, "update_contact", {
      office_id: contact.office_id,
      target_email: email || contact.email,
      meta: { contact_name: name || contact.name },
    });

    return NextResponse.json({ message: "Contact updated" });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });
    if (admin.role === "gate_user") return NextResponse.json({ message: "Insufficient permissions" }, { status: 403 });

    const supabase = createServiceClient();

    const { data: contact } = await supabase.from("office_contacts").select("*").eq("id", id).single();
    if (!contact) return NextResponse.json({ message: "Contact not found" }, { status: 404 });

    if (admin.role === "office_admin" && contact.office_id !== admin.office_id) {
      return NextResponse.json({ message: "You can only delete contacts for your office" }, { status: 403 });
    }

    const { error: deleteError } = await supabase.from("office_contacts").update({ active: false }).eq("id", id);
    if (deleteError) {
      return NextResponse.json({ message: "Failed to delete contact" }, { status: 500 });
    }

    await logAudit(admin.id, admin.email, "delete_contact", {
      office_id: contact.office_id,
      target_email: contact.email,
      meta: { contact_name: contact.name },
    });

    return NextResponse.json({ message: "Contact deleted" });
  } catch (error) {
    return handleRouteError(error);
  }
}