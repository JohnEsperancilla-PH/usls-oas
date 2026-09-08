import { NextResponse } from "next/server";

export function handleRouteError(error: unknown): NextResponse {
  console.error(error);
  return NextResponse.json({ message: "Internal server error" }, { status: 500 });
}