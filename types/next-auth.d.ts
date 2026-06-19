import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    access_token: string;
    tenant_id: string;
    roles: string[];
    /** M2-X-1: union of `tenant_role_admin_access.admin_access` across
     * the user's roles. Drives /dashboards/* visibility independent of
     * role identity, so operators can grant admin to whichever role
     * they pick in Settings → Roles. */
    admin_access: boolean;
    user: {
      id: string;
    } & DefaultSession["user"];
  }

  interface User {
    tenant_id: string;
    roles: string[];
    admin_access: boolean;
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
    admin_access: boolean;
    /** See `User.access_token_exp` above — copied here at sign-in by the
     * jwt callback, then read on every subsequent invocation to decide
     * whether to invalidate the Auth.js session. */
    access_token_exp: number;
  }
}
