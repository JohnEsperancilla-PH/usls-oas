import type { Appointment, AppointmentVisitor } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type AppointmentWithVisitors = Appointment & { visitors: AppointmentVisitor[] };

export async function attachAppointmentVisitors<T extends { id: string }>(
  supabase: Pick<SupabaseClient<Database>, "from">,
  appointments: T[]
): Promise<(T & { visitors: AppointmentVisitor[] })[]> {
  if (appointments.length === 0) return [];
  const ids = appointments.map((appointment) => appointment.id);
  const { data, error } = await supabase
    .from("appointment_visitors")
    .select("*")
    .in("appointment_id", ids)
    .order("visitor_number", { ascending: true });
  if (error) throw error;

  const byAppointment = new Map<string, AppointmentVisitor[]>();
  for (const visitor of (data || []) as AppointmentVisitor[]) {
    const list = byAppointment.get(visitor.appointment_id) || [];
    list.push(visitor);
    byAppointment.set(visitor.appointment_id, list);
  }

  return appointments.map((appointment) => ({
    ...appointment,
    visitors: byAppointment.get(appointment.id) || [],
  }));
}

export async function getAppointmentVisitors(supabase: Pick<SupabaseClient<Database>, "from">, appointmentId: string) {
  const [appointment] = await attachAppointmentVisitors(supabase, [{ id: appointmentId }]);
  return appointment?.visitors || [];
}