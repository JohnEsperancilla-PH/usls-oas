import { createServiceClient } from "@/lib/supabase/server";
import {
  MAINTENANCE_KEYS,
  INACTIVE_MAINTENANCE,
  resolveMaintenance,
  type MaintenanceState,
} from "@/lib/maintenance";

export async function getMaintenanceState(): Promise<MaintenanceState> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", MAINTENANCE_KEYS as unknown as string[]);

    if (error || !data) return INACTIVE_MAINTENANCE;

    const settings: Record<string, string> = {};
    data.forEach((row) => {
      settings[row.key] = row.value;
    });

    return resolveMaintenance(settings);
  } catch {
    return INACTIVE_MAINTENANCE;
  }
}

export async function isMaintenanceActive(): Promise<boolean> {
  return (await getMaintenanceState()).active;
}

export async function saveMaintenanceSettings(patch: Record<string, string>) {
  const supabase = createServiceClient();
  const updatedAt = new Date().toISOString();
  const rows = [...Object.entries(patch), ["maintenance_updated_at", updatedAt]].map(([key, value]) => ({
    key,
    value,
    updated_at: updatedAt,
  }));

  const { error } = await supabase
    .from("system_settings")
    .upsert(rows, { onConflict: "key" });

  if (error) throw new Error("Failed to save maintenance settings");
}
