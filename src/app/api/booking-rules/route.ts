import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { getBookingRules } from "@/lib/booking-rules-server";

// Public: the booking form uses these to grey out dates outside the booking window.
export async function GET() {
  try {
    return NextResponse.json(await getBookingRules());
  } catch (error) {
    return handleRouteError(error);
  }
}
