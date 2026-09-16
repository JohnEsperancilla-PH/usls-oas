import { NextResponse } from "next/server";
import { getAuthAdmin, requireEntryUser } from "@/lib/rbac";
import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getGateAuthEmail, normalizeEmployeeId } from "@/lib/entry-auth";

export async function GET(request: Request) {
  const { admin, error, status } = await getAuthAdmin(request);
  if (!admin) return NextResponse.json({ authenticated: false, message: error }, { status });
  const access = requireEntryUser(admin);
  if (!access.ok) return NextResponse.json({ authenticated: false, message: access.error }, { status: access.status });
  return NextResponse.json({ authenticated: true });
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "unknown";
  const { allowed } = checkRateLimit(`entry-auth:${ip}`, 10, 15 * 60 * 1000);
  if (!allowed) return rateLimitResponse();

  try {
    const body = await request.json();
    const employeeId = normalizeEmployeeId(typeof body.employeeId === "string" ? body.employeeId : "");
    if (!employeeId || typeof body.password !== "string" || !body.password) {
      return NextResponse.json({ authenticated: false, message: "Employee ID and password are required" }, { status: 400 });
    }

    const serviceClient = createServiceClient();
    const { data: account } = await serviceClient
      .from("admins")
      .select("email, role")
      .eq("employee_id", employeeId)
      .eq("role", "gate_user")
      .maybeSingle();
    if (!account) return NextResponse.json({ authenticated: false, message: "Invalid employee ID or password" }, { status: 401 });

    const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data, error } = await authClient.auth.signInWithPassword({ email: getGateAuthEmail(employeeId), password: body.password });
    if (error || !data.session) return NextResponse.json({ authenticated: false, message: "Invalid employee ID or password" }, { status: 401 });

    return NextResponse.json({ authenticated: true, session: data.session });
  } catch {
    return NextResponse.json({ authenticated: false, message: "Invalid request" }, { status: 400 });
  }
}