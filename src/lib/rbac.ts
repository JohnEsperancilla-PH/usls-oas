import { createServiceClient, createRouteClient } from "@/lib/supabase/server";
import type { Admin } from "@/types/database";

export interface AuthAdmin {
  id: string;
  email: string;
  name: string;
  employee_id: string | null;
  role: "super_admin" | "office_admin" | "gate_user";
  office_id: string | null;
  approval_status?: "pending" | "approved";
}

export async function getAuthAdmin(request: Request): Promise<{ admin: AuthAdmin | null; error?: string; status?: number }> {
  const routeClient = createRouteClient(request);
  const { data: { user }, error: sessionError } = await routeClient.auth.getUser();

  if (sessionError || !user) {
    return { admin: null, error: "Unauthorized", status: 401 };
  }

  const supabase = createServiceClient();
  const { data: admin, error } = await supabase
    .from("admins")
    .select("*")
    .eq("email", user.email!)
    .single();

  if (error || !admin) {
    return { admin: null, error: "Not authorized", status: 403 };
  }

  if (admin.approval_status === "pending") {
    return { admin: null, error: PENDING_APPROVAL_MESSAGE, status: 403 };
  }

  return { admin: admin as Admin };
}

export const PENDING_APPROVAL_MESSAGE = "Your account is waiting for a super admin to approve it.";

// Admin dashboard data and actions: super admins and office admins, not gate accounts.
export function requireDashboardAdmin(admin: AuthAdmin): { ok: boolean; error?: string; status?: number } {
  if (admin.role === "gate_user") {
    return { ok: false, error: "Insufficient permissions", status: 403 };
  }
  return { ok: true };
}

export function requireSuperAdmin(admin: AuthAdmin): { ok: boolean; error?: string; status?: number } {
  if (admin.role !== "super_admin") {
    return { ok: false, error: "Super admin access required", status: 403 };
  }
  return { ok: true };
}

export function requireEntryUser(admin: AuthAdmin): { ok: boolean; error?: string; status?: number } {
  if (admin.role !== "gate_user" && admin.role !== "super_admin") {
    return { ok: false, error: "Gate access required", status: 403 };
  }
  return { ok: true };
}

export async function logAudit(
  adminId: string | null,
  adminEmail: string,
  action: string,
  details: {
    appointment_id?: string;
    office_id?: string;
    target_email?: string;
    meta?: Record<string, unknown>;
  } = {}
) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("audit_logs").insert({
    admin_id: adminId,
    admin_email: adminEmail,
    action,
    appointment_id: details.appointment_id || null,
    office_id: details.office_id || null,
    target_email: details.target_email || null,
    details: details.meta || null,
  });
  // The action itself already happened, so don't fail the request, but never lose an audit entry silently.
  // A check-constraint error here usually means a migration adding this action hasn't been applied.
  if (error) {
    console.error(`Failed to write audit log for "${action}" by ${adminEmail}:`, error.message);
  }
}
