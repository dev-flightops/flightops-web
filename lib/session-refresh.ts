/**
 * When to refresh the backend access token, and how.
 *
 * Split out of auth.ts so it can be tested at all: importing that file
 * pulls next-auth -> next/server, which does not resolve under vitest.
 * Fifth time that has shaped a file in this repo, after
 * release-errors.ts, portal-ui.tsx, flight-results.tsx and
 * alerts-list.tsx. Nothing here imports next-auth; auth.ts calls in.
 *
 * Background: access tokens used to be all there was, so an expiring
 * token destroyed the session and threw the user back to the login page
 * mid-task. That is why the dev TTL is eight hours. With
 * flightops-services#176 there is a refresh path, and this is the half
 * that uses it.
 */

/** How long before expiry to swap the token.
 *
 *  Refreshing only once it has already expired means every request in
 *  flight at that moment gets a 401. Sixty seconds is comfortably
 *  longer than any single render and far shorter than the access-token
 *  lifetime, so the swap happens quietly between requests.
 */
export const REFRESH_MARGIN_SECONDS = 60;

export type SessionAction = "keep" | "refresh" | "expire";

export interface AccessTokenClaims {
  sub: string;
  tenant_id: string;
  roles: string[];
  admin_access?: boolean;
  email?: string;
  name?: string;
  exp: number;
}

export interface RefreshedSession {
  access_token: string;
  access_token_exp: number;
  refresh_token: string | null;
  tenant_id: string;
  roles: string[];
  admin_access: boolean;
}

/**
 * What to do with a session on this request.
 *
 *   keep     still comfortably valid
 *   refresh  inside the margin, or past it, and a refresh token exists
 *   expire   no way to continue — end the Auth.js session too, or the
 *            user is left "logged in but nothing works", which has no
 *            fix short of clearing cookies
 */
export function decideSessionAction(input: {
  exp: number | undefined;
  hasRefreshToken: boolean;
  nowSeconds?: number;
  marginSeconds?: number;
}): SessionAction {
  const {
    exp,
    hasRefreshToken,
    nowSeconds = Date.now() / 1000,
    marginSeconds = REFRESH_MARGIN_SECONDS,
  } = input;

  // No expiry claim at all — an old or malformed token. Leave it alone
  // rather than guessing; the backend still rejects it if it is dead.
  if (!exp) return "keep";

  if (nowSeconds < exp - marginSeconds) return "keep";
  if (hasRefreshToken) return "refresh";

  // Inside the margin with no way to refresh. Still usable until it
  // actually expires — cutting the session a minute early would be a
  // regression for SSO sessions, which have no refresh token.
  return nowSeconds >= exp ? "expire" : "keep";
}

/** Exchange a refresh token for a new access token.
 *
 *  Returns null on any failure — expired, revoked, or the backend being
 *  unreachable. The caller decides what that means, because "could not
 *  refresh" is not "session is over": inside the margin the existing
 *  token still works and the next request will try again.
 *
 *  Concurrency is handled server-side. Several requests from one page
 *  load can arrive here at once; flightops-services#177 makes the
 *  rotation atomic and hands every caller in a short window the same
 *  replacement, so parallel refreshes converge rather than logging the
 *  user out.
 */
export async function refreshAccessToken(
  refreshToken: string,
  deps: {
    apiBaseUrl?: string;
    fetchImpl?: typeof fetch;
    decode: (jwt: string) => AccessTokenClaims;
  },
): Promise<RefreshedSession | null> {
  const base = deps.apiBaseUrl ?? process.env.NEXT_PUBLIC_API_URL;
  if (!base) return null;
  const doFetch = deps.fetchImpl ?? fetch;

  try {
    const response = await doFetch(`${base}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
    if (!response.ok) return null;

    const body = (await response.json()) as {
      access_token: string;
      refresh_token?: string | null;
    };
    if (!body?.access_token) return null;

    const claims = deps.decode(body.access_token);
    return {
      access_token: body.access_token,
      access_token_exp: claims.exp,
      // Rotation: the presented token is dead the moment this succeeds,
      // so the new one has to replace it. Carrying the old value
      // forward would present a revoked token next time and trip reuse
      // detection, which revokes the whole family.
      refresh_token: body.refresh_token ?? null,
      // Re-read from the fresh claims rather than carrying the old
      // ones. A role change or an admin-access toggle then takes effect
      // at the next refresh instead of waiting for a full re-login.
      tenant_id: claims.tenant_id,
      roles: claims.roles,
      admin_access: claims.admin_access ?? false,
    };
  } catch {
    return null;
  }
}
