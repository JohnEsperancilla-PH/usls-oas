import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthAdmin, isDashboardRole } from "@/lib/rbac";
import { canInviteForOtherOffices } from "@/lib/invitation-access";
import { getAdminOfficeIds } from "@/lib/office-scope";

export const dynamic = "force-dynamic";

// Offices the signed-in admin can create invitations for, and whether they may pick one.
export async function GET(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });
    if (!isDashboardRole(admin.role)) return NextResponse.json({ message: "Insufficient permissions" }, { status: 403 });

    const canChooseOffice = await canInviteForOtherOffices(admin);

    const supabase = createServiceClient();
    let query = supabase.from("offices").select("*").eq("active", true).order("name");
    // Without the permission, an admin can still invite for their own office and its sub-offices.
    const officeIds = await getAdminOfficeIds(admin);
    if (!canChooseOffice && officeIds !== null) query = query.in("id", officeIds);

    const { data, error: fetchError } = await query;
    if (fetchError) {
      console.error(fetchError);
      return NextResponse.json({ message: "Failed to fetch offices" }, { status: 500 });
    }

    return NextResponse.json({ canChooseOffice: canChooseOffice || (officeIds?.length ?? 0) > 1, offices: data || [] });
  } catch (error) {
    return handleRouteError(error);
  }
}
