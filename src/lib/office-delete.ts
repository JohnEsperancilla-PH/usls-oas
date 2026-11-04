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

  const [accounts, upcoming, total] = await Promise.all([
    supabase.from("admins").select("id", { count: "exact", head: true }).eq("office_id", id),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("office_id", id)
      .in("status", ["pending", "approved", "postponed"]).gte("date", getManilaToday()),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("office_id", id),
  ]);
  if (accounts.error || upcoming.error || total.error) throw new Error("Failed to check office usage");

  const assignedAccounts = accounts.count ?? 0;
  const upcomingAppointments = upcoming.count ?? 0;
  const blockers: string[] = [];
  if (office.active) blockers.push("Deactivate the office first.");
  if (assignedAccounts > 0) blockers.push(`Move or remove the ${assignedAccounts} account${assignedAccounts !== 1 ? "s" : ""} assigned to this office on the Accounts page.`);
  if (upcomingAppointments > 0) blockers.push(`Decline or finish the ${upcomingAppointments} upcoming appointment${upcomingAppointments !== 1 ? "s" : ""} for this office.`);

  return { name: office.name, active: office.active, assignedAccounts, upcomingAppointments, totalAppointments: total.count ?? 0, blockers };
}
