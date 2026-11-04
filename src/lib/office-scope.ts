import { createServiceClient } from "@/lib/supabase/server";
import type { AuthAdmin } from "@/lib/rbac";

// Which offices an office admin acts for: their own office plus its sub-offices.
// Null means every office (super admins).
export async function getAdminOfficeIds(admin: AuthAdmin): Promise<string[] | null> {
  if (admin.role !== "office_admin") return null;
  if (!admin.office_id) return [];

  const supabase = createServiceClient();
  const { data } = await supabase.from("offices").select("id").eq("parent_office_id", admin.office_id);
  return [admin.office_id, ...(data || []).map((office) => office.id)];
}

// Appointments of a main office that this admin's sub-office was tagged on.
export async function getTaggedAppointmentIds(admin: AuthAdmin): Promise<string[]> {
  if (admin.role !== "office_admin" || !admin.office_id) return [];

  const supabase = createServiceClient();
  const { data } = await supabase.from("appointment_office_tags").select("appointment_id").eq("office_id", admin.office_id);
  return (data || []).map((tag) => tag.appointment_id);
}

// PostgREST filter for an office admin's appointments: their offices' appointments plus tagged ones.
// Null means no filter (super admins). Ids come from the database, so they're safe to interpolate.
export async function getAppointmentScopeFilter(admin: AuthAdmin, extra: string[] = []): Promise<string | null> {
  const officeIds = await getAdminOfficeIds(admin);
  if (officeIds === null) return null;

  const tagged = await getTaggedAppointmentIds(admin);
  const parts = [`office_id.in.(${officeIds.join(",") || "00000000-0000-0000-0000-000000000000"})`, ...extra];
  if (tagged.length > 0) parts.push(`id.in.(${tagged.join(",")})`);
  return parts.join(",");
}

export async function canAccessAppointment(admin: AuthAdmin, appointment: { id: string; office_id: string }): Promise<boolean> {
  const officeIds = await getAdminOfficeIds(admin);
  if (officeIds === null) return true;
  if (officeIds.includes(appointment.office_id)) return true;
  return (await getTaggedAppointmentIds(admin)).includes(appointment.id);
}

// For actions on an office's own records, such as blocked times and contacts.
export async function canManageOffice(admin: AuthAdmin, officeId: string): Promise<boolean> {
  const officeIds = await getAdminOfficeIds(admin);
  return officeIds === null || officeIds.includes(officeId);
}
