import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin } from "@/lib/rbac";
import { canInviteForOtherOffices } from "@/lib/invitation-access";

export const dynamic = "force-dynamic";

// Offices the signed-in admin can create invitations for, and whether they may pick one.
export async function GET(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });
    if (admin.role === "gate_user") return NextResponse.json({ message: "Insufficient permissions" }, { status: 403 });

    const canChooseOffice = await canInviteForOtherOffices(admin);

    const supabase = createServiceClient();
    let query = supabase.from("offices").select("*").eq("active", true).order("name");
    if (!canChooseOffice) query = query.eq("id", admin.office_id ?? "");

    const { data, error: fetchError } = await query;
    if (fetchError) {
      console.error(fetchError);
      return NextResponse.json({ message: "Failed to fetch offices" }, { status: 500 });
    }

    return NextResponse.json({ canChooseOffice, offices: data || [] });
  } catch (error) {
    return handleRouteError(error);
  }
}
