import { createServiceClient } from "@/lib/supabase/server";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Per-instance fallback, used only when the shared limiter (migration 038) is unavailable.
const store = new Map<string, RateLimitEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 60_000);

function checkMemoryRateLimit(key: string, maxRequests: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetIn: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetIn: entry.resetAt - now };
}

let sharedLimiterWarned = false;

// Fixed-window limit shared by every server instance through Postgres; falls back to memory if the database call fails.
export async function checkRateLimit(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult> {
  try {
    const { data, error } = await createServiceClient().rpc("hit_rate_limit", {
      p_key: key,
      p_max: maxRequests,
      p_window_ms: windowMs,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) throw error || new Error("No rate limit result");
    return { allowed: Boolean(row.allowed), remaining: Number(row.remaining), resetIn: Number(row.reset_in_ms) };
  } catch (err) {
    if (!sharedLimiterWarned) {
      sharedLimiterWarned = true;
      console.error("Shared rate limiter unavailable, using in-memory fallback. Apply migration 038_rate_limits.sql.", err);
    }
    return checkMemoryRateLimit(key, maxRequests, windowMs);
  }
}

export function rateLimitResponse(): Response {
  return Response.json(
    { message: "Too many requests. Please try again later." },
    { status: 429, headers: { "Content-Type": "application/json" } }
  );
}
