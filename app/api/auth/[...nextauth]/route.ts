import type { NextRequest } from "next/server";

import { handlers } from "@/auth";
import { clearsSession, overHttps, signedOutHeader } from "@/lib/auth/signed-out";

export const { GET } = handlers;

/** Auth.js's own endpoints. A sign-out here (the "Session expired" screen's
 *  Sign in again) also marks when this browser signed out (#201), as the
 *  app's Sign out does, but only one Auth.js accepted: it checks the CSRF
 *  token, and a refused one must change nothing. */
export async function POST(req: NextRequest): Promise<Response> {
  const res = await handlers.POST(req);
  if (!req.nextUrl.pathname.replace(/\/+$/, "").endsWith("/signout")) return res;
  if (!clearsSession(res)) return res;
  const marked = new Response(res.body, res);
  marked.headers.append("Set-Cookie", signedOutHeader(overHttps(req.headers, req.url)));
  return marked;
}
