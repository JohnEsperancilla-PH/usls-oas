import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { PENDING_APPROVAL_MESSAGE } from "@/lib/rbac";
import { recordSignIn } from "@/lib/sign-in-log";

// Admin sign-in. The password is checked here rather than in the browser so every attempt,
// including failures, can be logged. Returns a session for the browser to adopt.
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "unknown";
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const { allowed } = await checkRateLimit(`admin-login:${ip}`, 10, 60 * 1000);
  if (!allowed) {
    await recordSignIn(request, { portal: "admin", success: false, identifier: email, reason: "rate_limited" });
    return rateLimitResponse();
  }

  if (!email || !password) {
    return NextResponse.json({ message: "Enter your email and password." }, { status: 400 });
  }

  try {
    const { data: account } = await createServiceClient()
      .from("admins")
      .select("id, name, role, approval_status")
      .ilike("email", email)
      .maybeSingle();

    const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await authClient.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      await recordSignIn(request, { portal: "admin", success: false, identifier: email, reason: account ? "wrong_password" : "unknown_account", account });
      return NextResponse.json({ message: "Incorrect email or password." }, { status: 401 });
    }

    // Correct password, but the account can't use the dashboard. No session is handed out.
    const refuse = async (reason: "not_staff" | "wrong_portal" | "pending_approval", message: string) => {
      await recordSignIn(request, { portal: "admin", success: false, identifier: email, reason, account });
      await authClient.auth.signOut().catch(() => {});
      return NextResponse.json({ message }, { status: 403 });
    };
    if (!account) return refuse("not_staff", "This account is not registered as an admin.");
    if (account.role === "gate_user") return refuse("wrong_portal", "Guard accounts sign in on the Gate Entry page.");
    if (account.approval_status === "pending") return refuse("pending_approval", PENDING_APPROVAL_MESSAGE);

    await recordSignIn(request, { portal: "admin", success: true, identifier: email, account });
    return NextResponse.json({ session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } });
  } catch (err) {
    console.error("Admin sign-in failed:", err);
    return NextResponse.json({ message: "Could not sign in. Please try again." }, { status: 500 });
  }
}
