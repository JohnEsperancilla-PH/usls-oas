/** Only same-site paths are followed after sign-in, so a link can't send someone to another site. */
export function safeNextPath(next: string | null | undefined): string | null {
  return next && /^\/(?!\/)[\w\-/?=&]*$/.test(next) ? next : null;
}

/** The ?next= path from the current URL, if it's safe to follow. */
export function readNextPath(): string | null {
  if (typeof window === "undefined") return null;
  return safeNextPath(new URLSearchParams(window.location.search).get("next"));
}
