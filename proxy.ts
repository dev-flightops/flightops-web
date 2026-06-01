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

  if (!isLoggedIn && !isLoginPage) {
    return Response.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && isLoginPage) {
    return Response.redirect(new URL("/home/", req.url));
  }
});

// Match everything except Next.js internals, static assets, and the next-auth route.
export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
