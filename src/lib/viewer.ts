import { createClient, createServiceClient } from "@/lib/supabase/server";

export type ViewerRole = "super_admin" | "office_admin" | "gate_user" | "gate_admin" | null;

/** The signed-in staff role for a server-rendered page, or null for visitors and pending accounts. */
export async function getViewerRole(): Promise<ViewerRole> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return null;
    const { data: admin } = await createServiceClient()
      .from("admins")
      .select("role, approval_status")
      .eq("email", user.email)
      .maybeSingle();
    if (!admin || admin.approval_status === "pending") return null;
    return admin.role as ViewerRole;
  } catch {
    return null;
  }
}
