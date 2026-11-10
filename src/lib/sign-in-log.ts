import { createServiceClient } from "@/lib/supabase/server";

export type SignInFailure = "wrong_password" | "unknown_account" | "not_staff" | "pending_approval" | "wrong_portal" | "rate_limited" | "missing_fields";

/** The caller's IP and browser, for logs. */
export function clientInfo(request: Request) {
  return {
    ip: (request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "").trim().slice(0, 64) || null,
    user_agent: request.headers.get("user-agent")?.slice(0, 300) || null,
  };
}

/** Records one sign-in attempt. Never throws: logging must not block signing in. */
export async function recordSignIn(request: Request, entry: {
  portal: "admin" | "gate";
  success: boolean;
  identifier: string;
  reason?: SignInFailure | null;
  account?: { id: string; name?: string | null; role?: string | null } | null;
}) {
  try {
    const { error } = await createServiceClient().from("sign_in_logs").insert({
      portal: entry.portal,
      success: entry.success,
      identifier: entry.identifier.trim().slice(0, 255) || null,
      admin_id: entry.account?.id ?? null,
      name: entry.account?.name ?? null,
      role: entry.account?.role ?? null,
      reason: entry.success ? null : entry.reason ?? null,
      ...clientInfo(request),
    });
    // Missing table (migration 051 not applied): note it and carry on.
    if (error) console.error("Failed to record sign-in:", error.message);
  } catch (err) {
    console.error("Failed to record sign-in:", err);
  }
}
