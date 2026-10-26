"use client";

// fetch() for admin API calls that change data: attaches the CSRF token the server checks
// (double-submit: the x-csrf-token header must equal the __csrf_token cookie). Safe methods pass straight through.

const CSRF_COOKIE = "__csrf_token";

// Read the token from the cookie on every request so it always matches what the browser will send,
// even if another tab or page refreshed it.
function readCookieToken(): string | null {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${CSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : null;
}

let pending: Promise<string> | null = null;

// Ask the server to set (or re-send) the token cookie. Concurrent callers share one request.
function requestToken(): Promise<string> {
  if (!pending) {
    pending = fetch("/api/csrf-token", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Unable to obtain security token");
        const { csrfToken } = await res.json();
        return readCookieToken() || (csrfToken as string);
      })
      .finally(() => { pending = null; });
  }
  return pending;
}

export async function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return fetch(input, init);

  const send = async (forceRefresh: boolean) => {
    const token = (!forceRefresh && readCookieToken()) || (await requestToken());
    const headers = new Headers(init.headers);
    headers.set("x-csrf-token", token);
    return fetch(input, { ...init, headers });
  };

  const res = await send(false);
  if (res.status !== 403) return res;

  // The cookie may have expired between reading and sending: get it re-issued and retry once.
  const body = await res.clone().json().catch(() => null);
  return body?.message === "Invalid CSRF token" ? send(true) : res;
}
