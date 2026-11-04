import { createServiceClient } from "@/lib/supabase/server";
import { getManilaToday } from "@/lib/time";

export interface OfficeDeleteCheck {
  name: string;
  active: boolean;
  // Accounts assigned to the office. Deleting it would leave them with no office, which some pages treat as every office.
  assignedAccounts: number;
  // Visits still to come; deleting would void codes visitors were already sent.
  upcomingAppointments: number;
  // Every appointment for the office, past ones included. All are deleted with it.
  totalAppointments: number;
  blockers: string[];
}

export async function getOfficeDeleteCheck(id: string): Promise<OfficeDeleteCheck | null> {
  const supabase = createServiceClient();
  const { data: office, error } = await supabase.from("offices").select("id, name, active").eq("id", id).maybeSingle();
  if (error) throw new Error("Failed to load office");
  if (!office) return null;

  const [accounts, upcoming, total, subOffices] = await Promise.all([
    supabase.from("admins").select("id", { count: "exact", head: true }).eq("office_id", id),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("office_id", id)
      .in("status", ["pending", "approved", "postponed"]).gte("date", getManilaToday()),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("office_id", id),
    supabase.from("offices").select("id", { count: "exact", head: true }).eq("parent_office_id", id),
  ]);
  if (accounts.error || upcoming.error || total.error || subOffices.error) throw new Error("Failed to check office usage");

  const assignedAccounts = accounts.count ?? 0;
  const upcomingAppointments = upcoming.count ?? 0;
  const blockers: string[] = [];
  if (office.active) blockers.push("Deactivate the office first.");
  if (assignedAccounts > 0) blockers.push(`Move or remove the ${assignedAccounts} account${assignedAccounts !== 1 ? "s" : ""} assigned to this office on the Accounts page.`);
  const subOfficeCount = subOffices.count ?? 0;
  if (subOfficeCount > 0) blockers.push(`Delete or move the ${subOfficeCount} sub-office${subOfficeCount !== 1 ? "s" : ""} under this office first.`);
  if (upcomingAppointments > 0) blockers.push(`Decline or finish the ${upcomingAppointments} upcoming appointment${upcomingAppointments !== 1 ? "s" : ""} for this office.`);

  return { name: office.name, active: office.active, assignedAccounts, upcomingAppointments, totalAppointments: total.count ?? 0, blockers };
}

// Permanently deletes an inactive office. Check getOfficeDeleteCheck's blockers first.
// The database deletes its appointments, contacts, and blocked times with it.
export async function deleteInactiveOffice(id: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("offices").delete().eq("id", id).eq("active", false);
  if (error) {
    console.error(error);
    return false;
  }

  // Tags have no foreign key to offices (see migration 046), so they're cleared here.
  const { error: tagsError } = await supabase.from("appointment_office_tags").delete().eq("office_id", id);
  if (tagsError) console.error("Deleted office but could not clear its sub-office tags:", tagsError.message);
  return true;
}
