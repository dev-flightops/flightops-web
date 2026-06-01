import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Okta from "next-auth/providers/okta";

interface AuthServiceLoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface AccessTokenClaims {
  sub: string;
  tenant_id: string;
  roles: string[];
  email?: string;
  /** Display name embedded by auth-service so the UI can greet the user
   * without an extra round-trip. May be missing on older tokens. */
  name?: string;
  exp: number;
}

function decodeJwtPayload(token: string): AccessTokenClaims {
  const payload = token.split(".")[1];
  // base64url -> base64
  const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}

function apiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_URL not configured");
  return url;
}

/**
 * Build the providers list dynamically: Credentials is always on, each
 * OAuth provider only loads when its env vars are set. This matches what
 * the backend reports at `GET /auth/providers` — so a provider missing
 * server-side won't render a sign-in button on the login page either.
 *
 * When Phil drops the OAuth client IDs into the Vercel/Render env vars,
 * the providers below activate automatically — no code changes.
 */
function buildProviders(): Provider[] {
  const providers: Provider[] = [
    Credentials({
      name: "FlightOps",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;

        const response = await fetch(`${apiBaseUrl()}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        });

        if (!response.ok) return null;

        const body = (await response.json()) as AuthServiceLoginResponse;
        const claims = decodeJwtPayload(body.access_token);

        return {
          id: claims.sub,
          email: credentials.email as string,
          name: claims.name,
          tenant_id: claims.tenant_id,
          roles: claims.roles,
          access_token: body.access_token,
          access_token_exp: claims.exp,
        };
      },
    }),
  ];

  if (process.env.AUTH_GOOGLE_CLIENT_ID && process.env.AUTH_GOOGLE_CLIENT_SECRET) {
    providers.push(Google);
  }
  if (
    process.env.AUTH_MICROSOFT_ENTRA_ID_CLIENT_ID &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_CLIENT_SECRET
  ) {
    providers.push(MicrosoftEntraID);
  }
  if (process.env.AUTH_OKTA_CLIENT_ID && process.env.AUTH_OKTA_CLIENT_SECRET) {
    providers.push(Okta);
  }
  return providers;
}

/**
 * Exchange an upstream OAuth identity for a FlightOps JWT. The backend is
 * the single source of identity — Auth.js handles the OAuth dance, then
 * hands the verified `{provider, sub, email}` to auth-service which decides
 * whether the user is provisioned (403 if not).
 */
async function exchangeOAuthForFlightOpsJwt(
  provider: string,
  providerUserId: string,
  email: string,
): Promise<{ access_token: string; claims: AccessTokenClaims } | null> {
  const response = await fetch(`${apiBaseUrl()}/auth/oauth-exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider,
      provider_user_id: providerUserId,
      email,
    }),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as AuthServiceLoginResponse;
  return { access_token: body.access_token, claims: decodeJwtPayload(body.access_token) };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: buildProviders(),
  callbacks: {
    async signIn({ user, account }) {
      // Credentials sign-in is already a FlightOps login — `authorize`
      // returned the access_token. No exchange needed.
      if (!account || account.provider === "credentials") return true;

      if (!user.email) return false;
      const result = await exchangeOAuthForFlightOpsJwt(
        account.provider,
        account.providerAccountId ?? user.id ?? "",
        user.email,
      );
      if (!result) {
        // Unprovisioned user (403) or other backend error — refuse the
        // sign-in. Auth.js will redirect back to /login with an error.
        return false;
      }
      // Stash on the user object so the jwt callback can copy it onto
      // the session token. Auth.js mutates `user` between callbacks.
      (user as unknown as Record<string, unknown>).access_token = result.access_token;
      (user as unknown as Record<string, unknown>).tenant_id = result.claims.tenant_id;
      (user as unknown as Record<string, unknown>).roles = result.claims.roles;
      (user as unknown as Record<string, unknown>).access_token_exp = result.claims.exp;
      // Overwrite the sub so the session reports the FlightOps user id,
      // not the upstream provider's sub.
      user.id = result.claims.sub;
      // Prefer the name from our JWT (the User row's full_name) over the
      // provider's so the greeting matches what admins configured, not
      // whatever Google has on file.
      if (result.claims.name) user.name = result.claims.name;
      return true;
    },
    async jwt({ token, user }) {
      // Initial sign-in: copy the backend JWT + its expiry onto the
      // Auth.js token so subsequent calls can validate without an extra
      // round-trip.
      if (user) {
        token.access_token = user.access_token;
        token.tenant_id = user.tenant_id;
        token.roles = user.roles;
        token.access_token_exp = user.access_token_exp;
      }
      // Subsequent calls: if the backend JWT has expired, returning null
      // tells Auth.js to clear its own session cookie. Without this the
      // Auth.js cookie stays valid for its own (much longer) lifetime
      // even though every backend API call returns 401 — which leaves
      // the user in a wedged "logged in but nothing works" state where
      // the only fix is to delete cookies in DevTools.
      //
      // The `exp` claim is unix-seconds; we compare against now-in-seconds.
      // A small grace window would be wrong here — the backend already
      // honours its own `exp`, so a token even one second past expiry
      // gets rejected with 401.
      const exp = token.access_token_exp as number | undefined;
      if (exp && Date.now() / 1000 >= exp) {
        return null;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.access_token = token.access_token as string;
      session.tenant_id = token.tenant_id as string;
      session.roles = (token.roles as string[]) ?? [];
      return session;
    },
  },
});
