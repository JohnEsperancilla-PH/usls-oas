import type { AppointmentContact } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type AppointmentWithContacts = { id: string; contacts: AppointmentContact[] };

export async function attachAppointmentContacts<T extends { id: string }>(
  supabase: Pick<SupabaseClient<Database>, "from">,
  appointments: T[]
): Promise<(T & { contacts: AppointmentContact[] })[]> {
  if (appointments.length === 0) return [];
  const ids = appointments.map((appointment) => appointment.id);
  const { data, error } = await supabase
    .from("appointment_contacts")
    .select("*")
    .in("appointment_id", ids)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const byAppointment = new Map<string, AppointmentContact[]>();
  for (const contact of (data || []) as AppointmentContact[]) {
    const list = byAppointment.get(contact.appointment_id) || [];
    list.push(contact);
    byAppointment.set(contact.appointment_id, list);
  }

  return appointments.map((appointment) => ({
    ...appointment,
    contacts: byAppointment.get(appointment.id) || [],
  }));
}

export async function getAppointmentContacts(supabase: Pick<SupabaseClient<Database>, "from">, appointmentId: string) {
  const [appointment] = await attachAppointmentContacts(supabase, [{ id: appointmentId }]);
  return appointment?.contacts || [];
}