import { auth } from "@/auth";

/**
 * Auth guard. Legacy URLs are mixed (no slash on `/login`, slash on
 * `/home/` and `/dispatch/`), so we accept both forms when matching the
 * login page but always redirect *to* the canonical legacy form:
 *
 *   - unauthenticated → `/login` (no slash, no `?from=` — matches legacy)
 *   - authenticated on /login → `/home/` (slash, matches legacy)
 *
 * We don't preserve the originally requested path: the legacy login URL
 * is just `/login`, and Auth.js's own callback-url cookie handles the
 * post-OAuth return trip well enough.
 */
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const path = req.nextUrl.pathname;
  const isLoginPage = path === "/login" || path === "/login/";
  // Server Actions POST to their host page with a `next-action` header
  // and a serialised argument stream — a 302 to /login here would come
  // back to the client as a naked redirect, and Next.js's action layer
  // has no way to interpret it, so it throws
  // "An unexpected response was received from the server". Let those
  // POSTs through when unauthenticated: the action itself hits
  // `apiFetch`, throws SessionExpiredError, is caught in its own
  // try/catch, and returns a serialisable "please sign in again" error
  // the caller can render. router.refresh() from the caller then does
  // the bounce through a normal GET, which this same middleware
  // handles cleanly.
  const isServerAction = req.headers.get("next-action") !== null;

  if (!isLoggedIn && !isLoginPage && !isServerAction) {
    return Response.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && isLoginPage) {
    return Response.redirect(new URL("/home/", req.url));
  }
});

// Match everything except Next.js internals, the next-auth route, and
// the public images.
//
// `images/` was missing, so every file in public/images was redirected
// to /login for anyone signed out — including the photo on the login
// page itself, which only ever showed when it happened to be cached from
// a signed-in visit.
//
// Deliberately the one prefix and not the common "anything with a file
// extension" exemption: /api/dispatch/[flightId]/release.pdf is a
// protected route with an extension, and that pattern would serve every
// dispatch release to an anonymous request.
export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|images/).*)"],
};
