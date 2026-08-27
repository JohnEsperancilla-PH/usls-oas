import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

interface AuthCheckRequest {
  email: string;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "unknown";
  const { allowed } = checkRateLimit(`auth:${ip}`, 10, 60 * 1000);
  if (!allowed) return rateLimitResponse();

  try {
    const body: AuthCheckRequest = await request.json();

    if (!body.email) {
      return NextResponse.json({ message: "Email is required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: admin, error } = await supabase
      .from("admins")
      .select("*, offices(name)")
      .eq("email", body.email)
      .single();

    if (error || !admin) {
      return NextResponse.json({ authorized: false, message: "Not an admin" }, { status: 403 });
    }

    return NextResponse.json({ authorized: true, admin });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
