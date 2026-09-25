import { describe, expect, it, vi } from "vitest";

// proxy.ts wraps its handler in next-auth's `auth()`, which cannot load
// under vitest. Only the exported `config` is under test here.
vi.mock("@/auth", () => ({ auth: (handler: unknown) => handler }));

import { config } from "@/proxy";

/**
 * Which paths the auth proxy guards. Next compiles the matcher with
 * path-to-regexp; this one is a single catch-all group, so as a plain
 * anchored RegExp it matches the same paths.
 */
const guarded = (path: string) =>
  config.matcher.some((m) => new RegExp(`^${m}$`).test(path));

describe("auth proxy matcher", () => {
  it("lets the public images through, or the login photo cannot load", () => {
    // Every file in public/images used to 302 to /login for a signed-out
    // visitor — including the photo on the login page itself.
    expect(guarded("/images/home-hero.jpg")).toBe(false);
  });

  it("still guards the dispatch release PDF", () => {
    // The reason the fix is one prefix rather than "anything with a file
    // extension": this is a protected route that ends in .pdf.
    expect(guarded("/api/dispatch/0db850f5/release.pdf")).toBe(true);
  });

  it("still guards document downloads and ordinary pages", () => {
    expect(guarded("/api/documents/abc/download")).toBe(true);
    expect(guarded("/dispatch")).toBe(true);
    expect(guarded("/home/")).toBe(true);
  });

  it("does not exempt a page that merely starts with 'images'", () => {
    // `images/` with the slash, so a route named /imagesomething would
    // not slip past the guard.
    expect(guarded("/imagesomething")).toBe(true);
  });
});
