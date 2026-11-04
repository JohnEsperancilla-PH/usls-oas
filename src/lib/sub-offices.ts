import { createServiceClient } from "@/lib/supabase/server";

// Checks that `parentId` can be the main office of `officeId` (null when creating one).
// Sub-offices are one level deep: a main office can't be a sub-office, and a sub-office can't have its own.
export async function validateParentOffice(parentId: string, officeId: string | null): Promise<string | null> {
  if (officeId && parentId === officeId) return "An office can't be its own main office";

  const supabase = createServiceClient();
  const { data: parent } = await supabase.from("offices").select("id, parent_office_id").eq("id", parentId).maybeSingle();
  if (!parent) return "The main office wasn't found";
  if (parent.parent_office_id) return "A sub-office can't have sub-offices of its own";

  if (officeId) {
    const { count } = await supabase.from("offices").select("id", { count: "exact", head: true }).eq("parent_office_id", officeId);
    if ((count ?? 0) > 0) return "This office has sub-offices, so it can't become a sub-office";
  }
  return null;
}
