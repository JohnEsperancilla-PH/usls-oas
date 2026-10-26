import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

const CSRF_COOKIE_NAME = "__csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

// Reuses the browser's current token when it has one: minting a new token on every call replaced the
// cookie under other open tabs and pages, so their requests failed with "Invalid CSRF token".
export async function generateCsrfToken(request: Request): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  const token = existing && /^[0-9a-f]{64}$/.test(existing) ? existing : crypto.randomBytes(32).toString("hex");
  // Secure only over https (directly or behind a proxy): browsers drop Secure cookies on plain http,
  // which made every protected request fail on a production build served over http.
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const isHttps = forwardedProto ? forwardedProto === "https" : new URL(request.url).protocol === "https:";
  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return token;
}

export async function validateCsrfToken(request: Request): Promise<boolean> {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken) {
    return false;
  }

  if (cookieToken.length !== headerToken.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(cookieToken),
    Buffer.from(headerToken)
  );
}

export function csrfErrorResponse(): NextResponse {
  return NextResponse.json(
    { message: "Invalid CSRF token" },
    { status: 403 }
  );
}

export function isSafeMethod(method: string): boolean {
  return ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}
