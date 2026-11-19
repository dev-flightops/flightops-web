import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/auth", () => ({ handlers: { GET: vi.fn(), POST: () => post() } }));

import { POST } from "./route";

const setCookies = (res: Response) => res.headers.getSetCookie();
const signedOut = () =>
  new Response(JSON.stringify({ url: "/login" }), {
    headers: { "Set-Cookie": "__Secure-authjs.session-token=; Max-Age=0; Path=/" },
  });
const at = (path: string) => new NextRequest(`https://www.example.test${path}`, { method: "POST" });

describe("Auth.js's own sign-out marks it too (#201)", () => {
  it("adds when this browser signed out to a sign-out Auth.js accepted", async () => {
    post.mockResolvedValueOnce(signedOut());
    const res = await POST(at("/api/auth/signout"));
    const cookies = setCookies(res);
    expect(cookies[0]).toMatch(/^__Secure-authjs\.session-token=;/);
    expect(cookies[1]).toMatch(/^fo_signed_out_at=\d+; Path=\/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure$/);
    expect(await res.json()).toEqual({ url: "/login" });
  });

  it("leaves no mark when Auth.js refused it (no CSRF token: another site's form)", async () => {
    post.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { Location: "/login?error=MissingCSRF" } }),
    );
    const res = await POST(at("/api/auth/signout"));
    expect(setCookies(res).some((c) => c.startsWith("fo_signed_out_at="))).toBe(false);
    expect(res.status).toBe(302);
  });

  it("leaves a sign-in alone", async () => {
    post.mockResolvedValueOnce(
      new Response("{}", { headers: { "Set-Cookie": "__Secure-authjs.session-token=abc; Path=/" } }),
    );
    const res = await POST(at("/api/auth/callback/credentials"));
    expect(setCookies(res).some((c) => c.startsWith("fo_signed_out_at="))).toBe(false);
  });
});
