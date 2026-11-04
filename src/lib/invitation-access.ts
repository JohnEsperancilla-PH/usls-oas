import { createServiceClient } from "@/lib/supabase/server";
import type { AuthAdmin } from "@/lib/rbac";

// Super admins, and admins of offices allowed to invite on behalf of other offices
// (Offices > Edit > "Can create invitations for other offices").
export async function canInviteForOtherOffices(admin: AuthAdmin): Promise<boolean> {
  if (admin.role === "super_admin") return true;
  if (admin.role !== "office_admin" || !admin.office_id) return false;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("offices")
    .select("can_invite_for_other_offices")
    .eq("id", admin.office_id)
    .maybeSingle();
  return data?.can_invite_for_other_offices === true;
}
