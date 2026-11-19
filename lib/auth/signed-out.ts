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

/** The mark, for `cookies().set(...)`. Secure in production (https); the
 *  dev server and the test copies are plain http. */
export function signedOutCookie(now: number = Date.now()) {
  return {
    name: SIGNED_OUT_COOKIE,
    value: String(now),
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SIGNED_OUT_MAX_AGE_SECONDS,
  };
}

/** The mark as a Set-Cookie header, for a route handler's response. */
export function signedOutHeader(now: number = Date.now()): string {
  const c = signedOutCookie(now);
  return `${c.name}=${c.value}; Path=${c.path}; Max-Age=${c.maxAge}; HttpOnly; SameSite=Lax${c.secure ? "; Secure" : ""}`;
}
