import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getAuthAdmin, logAudit, PENDING_APPROVAL_MESSAGE } from "@/lib/rbac";

// Confirms the signed-in session belongs to a dashboard admin and returns that admin.
// Identity comes only from the session cookie; any email in the request body is ignored.
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "unknown";
  const { allowed } = await checkRateLimit(`auth:${ip}`, 10, 60 * 1000);
  if (!allowed) return rateLimitResponse();

  try {
    const { admin: sessionAdmin, error, status } = await getAuthAdmin(request);
    if (!sessionAdmin) {
      if (status === 401) return NextResponse.json({ authorized: false, message: "Not signed in" }, { status: 401 });
      const pending = error === PENDING_APPROVAL_MESSAGE;
      return NextResponse.json({ authorized: false, pending, message: pending ? error : "Not an admin" }, { status: 403 });
    }

    if (sessionAdmin.role === "gate_user") {
      return NextResponse.json({ authorized: false, message: "Gate accounts cannot access the admin dashboard" }, { status: 403 });
    }

    const supabase = createServiceClient();
    const { data: admin, error: fetchError } = await supabase
      .from("admins")
      .select("*, offices(name)")
      .eq("id", sessionAdmin.id)
      .single();

    if (fetchError || !admin) {
      return NextResponse.json({ authorized: false, message: error || "Not an admin" }, { status: 403 });
    }

    // Only an actual sign-in is audited, not every access check.
    const body = await request.json().catch(() => ({}));
    if (body?.event === "login") {
      await logAudit(admin.id, admin.email, "login", {
        meta: { ip, office_id: admin.office_id, role: admin.role },
      });
    }

    return NextResponse.json({ authorized: true, admin });
  } catch (error) {
    return handleRouteError(error);
  }
}
