import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const post = vi.fn(async () => new Response(JSON.stringify({ url: "/login" }), {
  headers: { "Set-Cookie": "__Secure-authjs.session-token=; Max-Age=0; Path=/" },
}));
vi.mock("@/auth", () => ({ handlers: { GET: vi.fn(), POST: () => post() } }));

import { POST } from "./route";

const setCookies = (res: Response) => res.headers.getSetCookie();

describe("Auth.js's own sign-out marks it too (#201)", () => {
  it("adds when this browser signed out to the sign-out's response", async () => {
    const res = await POST(new NextRequest("https://www.example.test/api/auth/signout", { method: "POST" }));
    const cookies = setCookies(res);
    expect(cookies[0]).toMatch(/^__Secure-authjs\.session-token=;/);
    expect(cookies[1]).toMatch(/^fo_signed_out_at=\d+; Path=\/; Max-Age=2592000; HttpOnly; SameSite=Lax/);
    expect(await res.json()).toEqual({ url: "/login" });
  });

  it("leaves a sign-in alone", async () => {
    const res = await POST(
      new NextRequest("https://www.example.test/api/auth/callback/credentials", { method: "POST" }),
    );
    expect(setCookies(res).some((c) => c.startsWith("fo_signed_out_at="))).toBe(false);
  });
});
