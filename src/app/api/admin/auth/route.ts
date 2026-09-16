import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/rbac";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "unknown";
  const { allowed } = checkRateLimit(`auth:${ip}`, 10, 60 * 1000);
  if (!allowed) return rateLimitResponse();

  try {
    const body = await request.json();

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

    if (admin.role === "gate_user") {
      return NextResponse.json({ authorized: false, message: "Gate accounts cannot access the admin dashboard" }, { status: 403 });
    }

    // Record successful admin login/access so it appears in the audit logs.
    await logAudit(admin.id, admin.email, "login", {
      meta: { ip, office_id: admin.office_id, role: admin.role },
    });

    return NextResponse.json({ authorized: true, admin });
  } catch (error) {
    return handleRouteError(error);
  }
}
