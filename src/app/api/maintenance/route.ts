import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { getMaintenanceState } from "@/lib/maintenance-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await getMaintenanceState();

    return NextResponse.json(
      {
        active: state.active,
        reason: state.reason,
        headline: state.headline,
        message: state.message,
        contactEmail: state.contactEmail,
        startAt: state.startAt,
        endAt: state.endAt,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
