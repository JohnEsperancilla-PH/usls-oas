import { NextResponse } from "next/server";
import { getAuthAdmin, requireEntryUser } from "@/lib/rbac";
import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getGateAuthEmail, normalizeEmployeeId, escapeLikePattern } from "@/lib/entry-auth";

export async function GET(request: Request) {
  const { admin, error, status } = await getAuthAdmin(request);
  if (!admin) return NextResponse.json({ authenticated: false, message: error }, { status });
  const access = requireEntryUser(admin);
  if (!access.ok) return NextResponse.json({ authenticated: false, message: access.error }, { status: access.status });
  return NextResponse.json({ authenticated: true, officerName: admin.name });
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "unknown";
  const { allowed } = checkRateLimit(`entry-auth:${ip}`, 10, 15 * 60 * 1000);
  if (!allowed) return rateLimitResponse();

  try {
    const body = await request.json();
    const identifier = typeof body.employeeId === "string" ? body.employeeId.trim() : "";
    const normalizedId = normalizeEmployeeId(identifier);
    if (!identifier || typeof body.password !== "string" || !body.password) {
      return NextResponse.json({ authenticated: false, message: "Employee ID or username and password are required" }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // 1) Try an exact employee ID match.
    const { data: byId } = await serviceClient
      .from("admins")
      .select("name, email, role, employee_id")
      .eq("role", "gate_user")
      .eq("employee_id", normalizedId)
      .maybeSingle();

    let account = byId;

    // 2) Otherwise, fall back to a username (name) match. .eq()/.ilike() pass the
    //    value as a safe parameter, so user input is never parsed as filter syntax.
    if (!account) {
      const { data: byName } = await serviceClient
        .from("admins")
        .select("name, email, role, employee_id")
        .eq("role", "gate_user")
        .ilike("name", escapeLikePattern(identifier))
        .limit(2);

      if (byName && byName.length > 1) {
        return NextResponse.json(
          { authenticated: false, message: "More than one account matches that username. Please use your employee ID instead." },
          { status: 401 }
        );
      }
      account = byName?.[0] ?? null;
    }

    if (!account || !account.employee_id) return NextResponse.json({ authenticated: false, message: "Invalid employee ID, username, or password" }, { status: 401 });

    const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data, error } = await authClient.auth.signInWithPassword({ email: getGateAuthEmail(account.employee_id), password: body.password });
    if (error || !data.session) return NextResponse.json({ authenticated: false, message: "Invalid employee ID, username, or password" }, { status: 401 });

    return NextResponse.json({ authenticated: true, session: data.session, officerName: account.name });
  } catch {
    return NextResponse.json({ authenticated: false, message: "Invalid request" }, { status: 400 });
  }
}