import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { getAuthAdmin, requireDashboardAdmin, requireEntryUser } from "@/lib/rbac";
import { getActiveSystemAlert } from "@/lib/system-alert-server";

// Staff popups only. The landing page's popup is rendered by the server, so nothing here is public.
export async function GET(request: Request) {
  try {
    const { admin, error, status } = await getAuthAdmin(request);
    if (!admin) return NextResponse.json({ message: error }, { status });

    const audience = new URL(request.url).searchParams.get("audience");
    if (audience !== "admin" && audience !== "gate") {
      return NextResponse.json({ message: "Invalid audience" }, { status: 400 });
    }

    const access = audience === "admin" ? requireDashboardAdmin(admin) : requireEntryUser(admin);
    if (!access.ok) return NextResponse.json({ message: access.error }, { status: access.status });

    return NextResponse.json({ alert: await getActiveSystemAlert(audience) });
  } catch (error) {
    return handleRouteError(error);
  }
}
