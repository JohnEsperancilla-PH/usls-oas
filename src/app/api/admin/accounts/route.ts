import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
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
    const { name, email, employee_id, role, office_id, password } = body;

    if (!name || !role || !password || (role !== "gate_user" && !email)) {
      return NextResponse.json({ message: "Name, role, password, and the required identifier are required" }, { status: 400 });
    }

    // Input validation
    if (name.length > 100) {
      return NextResponse.json({ message: "Name is too long (max 100 characters)" }, { status: 400 });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (role !== "gate_user" && (!emailRegex.test(email) || email.length > 254)) {
      return NextResponse.json({ message: "Invalid email format" }, { status: 400 });
    }
    if (!["super_admin", "office_admin", "gate_user"].includes(role)) {
      return NextResponse.json({ message: "Invalid role" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ message: "Password must be at least 8 characters" }, { status: 400 });
    }
    if (password.length > 128) {
      return NextResponse.json({ message: "Password is too long (max 128 characters)" }, { status: 400 });
    }

    if (role === "office_admin" && !office_id) {
      return NextResponse.json({ message: "Office is required for office admins" }, { status: 400 });
    }
    if (role === "gate_user" && (!employee_id || !/^[A-Za-z0-9-]{3,30}$/.test(employee_id))) {
      return NextResponse.json({ message: "A valid employee ID is required for gate users" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const normalizedEmployeeId = typeof employee_id === "string" ? employee_id.trim().toUpperCase() : null;

    if (role === "gate_user" && !normalizedEmployeeId) {
      return NextResponse.json({ message: "A valid employee ID is required for gate users" }, { status: 400 });
    }

    if (normalizedEmployeeId) {
      const { data: existingEmployee } = await supabase
        .from("admins")
        .select("id")
        .eq("employee_id", normalizedEmployeeId)
        .maybeSingle();
      if (existingEmployee) {
        return NextResponse.json({ message: "That employee ID is already in use" }, { status: 409 });
      }
    }

    const authEmail = role === "gate_user"
      ? `gate.${normalizedEmployeeId!.toLowerCase()}@auth.usls-oas.local`
      : email;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
    });

    if (authError) {
      return NextResponse.json({ message: authError.message }, { status: 400 });
    }

    const { error: insertError } = await supabase.from("admins").insert({
      id: authData.user.id,
      name,
      email: authEmail,
      employee_id: role === "gate_user" ? normalizedEmployeeId : null,
      role,
      office_id: role === "office_admin" ? office_id : null,
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
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });

    const check = requireSuperAdmin(admin);
    if (!check.ok) return NextResponse.json({ message: check.error }, { status: check.status });

    const body = await request.json();
    const { id: targetAdminId, password } = body;

    if (!targetAdminId) {
      return NextResponse.json({ message: "Admin ID is required" }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ message: "Password is required" }, { status: 400 });
    }

    // Verify the super admin's password
    const { createClient } = await import("@supabase/supabase-js");
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error: signInError } = await authClient.auth.signInWithPassword({
      email: admin.email,
      password,
    });

    if (signInError) {
      return NextResponse.json({ message: "Incorrect password" }, { status: 403 });
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

    const { data: authUsers, error: listUsersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (listUsersError) {
      return NextResponse.json({ message: "Failed to fetch auth users" }, { status: 500 });
    }

    const authUser = authUsers.users.find(
      (user) => user.email?.toLowerCase() === targetAdmin.email.toLowerCase()
    );

    if (authUser) {
      const { error: deleteUserError } = await supabase.auth.admin.deleteUser(authUser.id);
      if (deleteUserError) {
        return NextResponse.json({ message: "Failed to delete auth user" }, { status: 500 });
      }
    }

    await logAudit(admin.id, admin.email, "delete_account", {
      target_email: targetAdmin.email,
    });

    return NextResponse.json({ message: "Account deleted" });
  } catch (error) {
    return handleRouteError(error);
  }
}
