import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

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
  exp: number;
}

function decodeJwtPayload(token: string): AccessTokenClaims {
  const payload = token.split(".")[1];
  // base64url -> base64
  const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "FlightOps",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        if (!apiUrl) {
          throw new Error("NEXT_PUBLIC_API_URL not configured");
        }

        const response = await fetch(`${apiUrl}/auth/login`, {
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
          tenant_id: claims.tenant_id,
          roles: claims.roles,
          access_token: body.access_token,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.access_token = user.access_token;
        token.tenant_id = user.tenant_id;
        token.roles = user.roles;
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
