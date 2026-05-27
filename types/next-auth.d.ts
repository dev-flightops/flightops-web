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
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    access_token: string;
    tenant_id: string;
    roles: string[];
  }
}
