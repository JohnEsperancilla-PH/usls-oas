import { createServiceClient } from "@/lib/supabase/server";
import { SYSTEM_ALERT_KEYS, resolveSystemAlert, type SystemAlert, type SystemAlertAudience } from "@/lib/system-alert";

export async function getSystemAlertSettings(): Promise<Record<string, string>> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("system_settings")
    .select("key, value")
    .in("key", SYSTEM_ALERT_KEYS);
  if (error) throw new Error("Failed to load system update popup settings");

  const settings: Record<string, string> = {};
  data?.forEach((row) => { settings[row.key] = row.value; });
  return settings;
}

// A failed read just means no popup; it must never break the page showing it.
export async function getActiveSystemAlert(audience: SystemAlertAudience): Promise<SystemAlert | null> {
  try {
    return resolveSystemAlert(await getSystemAlertSettings(), audience);
  } catch {
    return null;
  }
}
