import { createServiceClient } from "@/lib/supabase/server";
import { DEFAULT_ENTRY_WINDOW, ENTRY_WINDOW_KEYS, parseEntryWindow, type EntryWindow } from "@/lib/entry-window";

export async function getEntryWindow(): Promise<EntryWindow> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ENTRY_WINDOW_KEYS);
    if (error) return DEFAULT_ENTRY_WINDOW;

    const values: Record<string, string> = {};
    data?.forEach((row) => { values[row.key] = row.value; });
    return parseEntryWindow(values);
  } catch {
    return DEFAULT_ENTRY_WINDOW;
  }
}
