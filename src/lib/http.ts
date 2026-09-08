import { NextResponse } from "next/server";

export function sanitizeError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  return msg
    .replace(/password[^,]*/gi, "password [redacted]")
    .replace(/key[^,]*/gi, "key [redacted]")
    .replace(/token[^,]*/gi, "token [redacted]")
    .replace(/secret[^,]*/gi, "secret [redacted]")
    .replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, "[ip]")
    .replace(/supabase\.co[^\s]*/gi, "[supabase-url]");
}

export function handleRouteError(error: unknown): NextResponse {
  console.error(sanitizeError(error));
  return NextResponse.json({ message: "Internal server error" }, { status: 500 });
}