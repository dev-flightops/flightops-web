import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    access_token: string;
    tenant_id: string;
    roles: string[];
    user: {
      id: string;
    } & DefaultSession["user"];
  }

  interface User {
    tenant_id: string;
    roles: string[];
    access_token: string;
    /** Unix-seconds exp from the backend JWT, copied so the Auth.js
     * jwt callback can clear the session when the FlightOps token has
     * expired. */
    access_token_exp: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    access_token: string;
    tenant_id: string;
    roles: string[];
    /** See `User.access_token_exp` above — copied here at sign-in by the
     * jwt callback, then read on every subsequent invocation to decide
     * whether to invalidate the Auth.js session. */
    access_token_exp: number;
  }
}
