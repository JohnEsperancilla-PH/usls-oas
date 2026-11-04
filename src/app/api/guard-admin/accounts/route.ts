import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, logAudit, requireGuardAdmin } from "@/lib/rbac";
import { validateCsrfToken, csrfErrorResponse } from "@/lib/csrf";
import { getGateAuthEmail, normalizeEmployeeId } from "@/lib/entry-auth";

// Guard admins list and create guard (gate_user) accounts. The role is fixed here, whatever the body says.

export async function GET(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });
    const access = requireGuardAdmin(admin);
    if (!access.ok) return NextResponse.json({ message: access.error }, { status: access.status });

    const { data, error: fetchError } = await createServiceClient()
      .from("admins")
      .select("id, name, employee_id, created_at")
      .eq("role", "gate_user")
      .order("name", { ascending: true });
    if (fetchError) return NextResponse.json({ message: "Failed to fetch guard accounts" }, { status: 500 });

    return NextResponse.json(data || []);
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
    const access = requireGuardAdmin(admin);
    if (!access.ok) return NextResponse.json({ message: access.error }, { status: access.status });

    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const employeeId = typeof body.employee_id === "string" ? normalizeEmployeeId(body.employee_id) : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!name) return NextResponse.json({ message: "Enter the guard's name" }, { status: 400 });
    if (name.length > 100) return NextResponse.json({ message: "Name is too long (max 100 characters)" }, { status: 400 });
    if (!/^[A-Z0-9-]{3,30}$/.test(employeeId)) {
      return NextResponse.json({ message: "Username must be 3–30 letters, numbers, or dashes" }, { status: 400 });
    }
    if (password.length < 8) return NextResponse.json({ message: "Password must be at least 8 characters" }, { status: 400 });
    if (password.length > 128) return NextResponse.json({ message: "Password is too long (max 128 characters)" }, { status: 400 });

    const supabase = createServiceClient();
    const { data: existing } = await supabase.from("admins").select("id").eq("employee_id", employeeId).maybeSingle();
    if (existing) return NextResponse.json({ message: "That username is already in use" }, { status: 409 });

    const authEmail = getGateAuthEmail(employeeId);
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({ email: authEmail, password, email_confirm: true });
    if (authError) return NextResponse.json({ message: authError.message }, { status: 400 });

    const { error: insertError } = await supabase.from("admins").insert({
      id: authData.user.id,
      name,
      email: authEmail,
      employee_id: employeeId,
      role: "gate_user",
      office_id: null,
    });
    if (insertError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ message: "Failed to create the guard account" }, { status: 500 });
    }

    await logAudit(admin.id, admin.email, "create_account", {
      target_email: authEmail,
      meta: { name, role: "gate_user", employee_id: employeeId, created_by_role: admin.role },
    });

    return NextResponse.json({ message: "Guard account created", id: authData.user.id }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
