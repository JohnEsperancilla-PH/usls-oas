import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Ids of offices that accept appointments (see office-online.ts for the rule).
 * Null when the accounts couldn't be read: callers then treat every office as online, so a
 * database hiccup never blocks all bookings.
 */
export async function getOnlineOfficeIds(supabase: SupabaseClient = createServiceClient()): Promise<Set<string> | null> {
  const [{ data: admins, error: adminsError }, { data: offices, error: officesError }] = await Promise.all([
    supabase.from("admins").select("office_id, approval_status").eq("role", "office_admin").not("office_id", "is", null),
    supabase.from("offices").select("id, parent_office_id"),
  ]);
  if (adminsError || officesError) {
    console.error("Failed to check which offices are online:", (adminsError || officesError)?.message);
    return null;
  }

  const staffed = new Set((admins || []).filter((a) => a.approval_status !== "pending").map((a) => a.office_id as string));
  const online = new Set(staffed);
  for (const office of offices || []) {
    if (office.parent_office_id && staffed.has(office.parent_office_id)) online.add(office.id);
  }
  return online;
}

export async function isOfficeOnline(officeId: string, supabase: SupabaseClient = createServiceClient()): Promise<boolean> {
  const online = await getOnlineOfficeIds(supabase);
  return online === null || online.has(officeId);
}
