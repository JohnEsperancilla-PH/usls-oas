import type { AppointmentVehicle } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type AppointmentWithVehicles = { id: string; vehicles: AppointmentVehicle[] };

export async function attachAppointmentVehicles<T extends { id: string }>(
  supabase: Pick<SupabaseClient<Database>, "from">,
  appointments: T[]
): Promise<(T & { vehicles: AppointmentVehicle[] })[]> {
  if (appointments.length === 0) return [];
  const ids = appointments.map((appointment) => appointment.id);
  const { data, error } = await supabase
    .from("appointment_vehicles")
    .select("*")
    .in("appointment_id", ids)
    .order("vehicle_number", { ascending: true });
  if (error) throw error;

  const byAppointment = new Map<string, AppointmentVehicle[]>();
  for (const vehicle of (data || []) as AppointmentVehicle[]) {
    const list = byAppointment.get(vehicle.appointment_id) || [];
    list.push(vehicle);
    byAppointment.set(vehicle.appointment_id, list);
  }

  return appointments.map((appointment) => ({
    ...appointment,
    vehicles: byAppointment.get(appointment.id) || [],
  }));
}

export async function getAppointmentVehicles(supabase: Pick<SupabaseClient<Database>, "from">, appointmentId: string) {
  const [appointment] = await attachAppointmentVehicles(supabase, [{ id: appointmentId }]);
  return appointment?.vehicles || [];
}
