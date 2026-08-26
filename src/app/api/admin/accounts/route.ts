import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, requireSuperAdmin, logAudit } from "@/lib/rbac";

export async function GET(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });

    const check = requireSuperAdmin(admin);
    if (!check.ok) return NextResponse.json({ message: check.error }, { status: check.status });

    const supabase = createServiceClient();

    const { data, error: fetchError } = await supabase
      .from("admins")
      .select("*, offices(name)")
      .order("created_at", { ascending: false });

    if (fetchError) {
      return NextResponse.json({ message: "Failed to fetch accounts" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Accounts GET error:", error);
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
    const { name, email, role, office_id, password } = body;

    if (!name || !email || !role || !password) {
      return NextResponse.json({ message: "Name, email, role, and password are required" }, { status: 400 });
    }

    if (role === "office_admin" && !office_id) {
      return NextResponse.json({ message: "Office is required for office admins" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return NextResponse.json({ message: authError.message }, { status: 400 });
    }

    const { error: insertError } = await supabase.from("admins").insert({
      name,
      email,
      role,
      office_id: role === "super_admin" ? null : office_id,
    });

    if (insertError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ message: "Failed to create admin record" }, { status: 500 });
    }

    await logAudit(admin.id, admin.email, "create_account", {
      target_email: email,
      meta: { name, role, office_id },
    });

    return NextResponse.json({ message: "Account created", userId: authData.user.id }, { status: 201 });
  } catch (error) {
    console.error("Accounts POST error:", error);
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
    const targetAdminId = searchParams.get("id");

    if (!targetAdminId) {
      return NextResponse.json({ message: "Admin ID is required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: targetAdmin, error: fetchError } = await supabase
      .from("admins")
      .select("*")
      .eq("id", targetAdminId)
      .single();

    if (fetchError || !targetAdmin) {
      return NextResponse.json({ message: "Admin not found" }, { status: 404 });
    }

    if (targetAdmin.id === admin.id) {
      return NextResponse.json({ message: "Cannot delete your own account" }, { status: 400 });
    }

    const { error: deleteAdminError } = await supabase
      .from("admins")
      .delete()
      .eq("id", targetAdminId);

    if (deleteAdminError) {
      return NextResponse.json({ message: "Failed to delete admin record" }, { status: 500 });
    }

    await supabase.auth.admin.deleteUser(targetAdminId);

    await logAudit(admin.id, admin.email, "delete_account", {
      target_email: targetAdmin.email,
    });

    return NextResponse.json({ message: "Account deleted" });
  } catch (error) {
    console.error("Accounts DELETE error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
