import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { getBookingRules } from "@/lib/booking-rules-server";

// Public: the booking form uses these to grey out dates outside the booking window.
export async function GET(request: Request) {
  try {
    // With an officeId, the office's own limits apply on top of the system rules.
    return NextResponse.json(await getBookingRules(new URL(request.url).searchParams.get("officeId")));
  } catch (error) {
    return handleRouteError(error);
  }
}
