/**
 * Sign out holds (#201).
 *
 * The session is an Auth.js JWT cookie, and the proxy re-issues it on every
 * response it passes, link prefetches included. A request sent just before
 * Sign out and answered just after it brought the old cookie back: pressed
 * half a second after a page loaded, Sign out did not hold 1 time in 3, and
 * on a shared iPad the next person would have been signed in as the last.
 *
 * So signing out leaves a mark in its own cookie: when this browser last
 * signed out. A session that began before the mark is one a late response
 * put back, and the session check refuses it (and clears it). A sign-in
 * always begins after the mark.
 */

/** When this browser last signed out, in epoch milliseconds. */
export const SIGNED_OUT_COOKIE = "fo_signed_out_at";

/** As long as a session can live (Auth.js's 30 days), so the mark outlasts
 *  any session from before it. */
export const SIGNED_OUT_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** The session began before this browser's last sign-out. A session with
 *  no start (one from before #201) counts as having begun at 0. */
export function signedOutSince(loginAt: unknown, mark: string | undefined): boolean {
  if (!mark) return false;
  const signedOutAt = Number(mark);
  if (!Number.isFinite(signedOutAt)) return false;
  const began = typeof loginAt === "number" && Number.isFinite(loginAt) ? loginAt : 0;
  return signedOutAt >= began;
}

/** When a new session begins: now, and always after the last sign-out, even
 *  on a server whose clock runs a little behind the one that signed out. */
export function sessionStart(mark: string | undefined, now: number = Date.now()): number {
  const signedOutAt = Number(mark);
  return Number.isFinite(signedOutAt) && signedOutAt >= now ? signedOutAt + 1 : now;
}

/** Auth.js's session cookie, in either form (`__Secure-` on https) and
 *  either whole or in chunks (`.0`, `.1`). */
const SESSION_COOKIE = /^(__Secure-)?authjs\.session-token(\.\d+)?$/;

/** A Cookie header without the session (#201): what the proxy passes on
 *  for a request whose session it refused, so the page or the action behind
 *  it can't read that session again. Null when there is nothing to take. */
export function withoutSessionCookies(header: string | null): string | null {
  if (!header) return null;
  const pairs = header.split(";").map((pair) => pair.trim()).filter(Boolean);
  const kept = pairs.filter((pair) => !SESSION_COOKIE.test(pair.split("=")[0]));
  return kept.length === pairs.length ? null : kept.join("; ");
}

/** Auth.js cleared the session in this response: a sign-out it accepted.
 *  One it refused (a missing or wrong CSRF token, say, from another site's
 *  form) clears nothing, and must leave no mark either. */
export function clearsSession(res: Response): boolean {
  return res.headers.getSetCookie().some((cookie) => {
    const [pair] = cookie.split(";");
    const [name, value = ""] = pair.split("=");
    return SESSION_COOKIE.test(name.trim()) && value.trim() === "";
  });
}

/** The request came over https, as Auth.js judges its own cookies: on
 *  Vercel the forwarded protocol, else the URL itself. Safari drops a
 *  Secure cookie sent over plain http, so the mark is Secure only on https
 *  (a production build served over http left Safari with no mark at all). */
export function overHttps(headers: Headers, url?: string): boolean {
  const forwarded = (headers.get("x-forwarded-proto") ?? "").split(",")[0].trim();
  if (forwarded) return forwarded === "https";
  return (url ?? headers.get("origin") ?? "").startsWith("https:");
}

/** The mark, for `cookies().set(...)`. */
export function signedOutCookie(secure: boolean, now: number = Date.now()) {
  return {
    name: SIGNED_OUT_COOKIE,
    value: String(now),
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: SIGNED_OUT_MAX_AGE_SECONDS,
  };
}

/** The mark as a Set-Cookie header, for a route handler's response. */
export function signedOutHeader(secure: boolean, now: number = Date.now()): string {
  const c = signedOutCookie(secure, now);
  return `${c.name}=${c.value}; Path=${c.path}; Max-Age=${c.maxAge}; HttpOnly; SameSite=Lax${c.secure ? "; Secure" : ""}`;
}
