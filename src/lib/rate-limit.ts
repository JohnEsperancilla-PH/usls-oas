interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 60_000);

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
  }

  if (entry.count >= maxRequests) {
    const resetIn = entry.resetAt - now;
    return { allowed: false, remaining: 0, resetIn };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetIn: entry.resetAt - now };
}

export function getRateLimitHeaders(
  key: string,
  maxRequests: number,
  windowMs: number
): Record<string, string> {
  const result = checkRateLimit(key, maxRequests, windowMs);
  return {
    "X-RateLimit-Limit": String(maxRequests),
    "X-RateLimit-Remaining": String(Math.max(0, result.remaining)),
    "X-RateLimit-Reset": String(Math.ceil((Date.now() + result.resetIn) / 1000)),
    ...(result.allowed ? {} : { "Retry-After": String(Math.ceil(result.resetIn / 1000)) }),
  };
}

export function rateLimitResponse(): Response {
  return Response.json(
    { message: "Too many requests. Please try again later." },
    { status: 429, headers: { "Content-Type": "application/json" } }
  );
}
