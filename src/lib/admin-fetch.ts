"use client";

// fetch() for admin API calls that change data: attaches the CSRF token the server checks
// (double-submit cookie from /api/csrf-token). Safe methods pass straight through.

let tokenPromise: Promise<string> | null = null;

function getCsrfToken(refresh = false): Promise<string> {
  if (!tokenPromise || refresh) {
    tokenPromise = fetch("/api/csrf-token")
      .then(async (res) => {
        if (!res.ok) throw new Error("Unable to obtain security token");
        const { csrfToken } = await res.json();
        return csrfToken as string;
      })
      .catch((err) => {
        tokenPromise = null;
        throw err;
      });
  }
  return tokenPromise;
}

export async function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return fetch(input, init);

  const send = async (refresh: boolean) => {
    const headers = new Headers(init.headers);
    headers.set("x-csrf-token", await getCsrfToken(refresh));
    return fetch(input, { ...init, headers });
  };

  const res = await send(false);
  if (res.status !== 403) return res;

  // The token cookie may have expired or been replaced by another tab: get a fresh one and retry once.
  const body = await res.clone().json().catch(() => null);
  return body?.message === "Invalid CSRF token" ? send(true) : res;
}
