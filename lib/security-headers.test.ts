import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";
import { SECURITY_HEADERS } from "./security-headers";

const byKey = Object.fromEntries(SECURITY_HEADERS.map((h) => [h.key, h.value]));

describe("security headers (code audit, 26 Nov)", () => {
  it("are on every page", async () => {
    expect(await nextConfig.headers?.()).toEqual([{ source: "/:path*", headers: SECURITY_HEADERS }]);
  });

  it("let no other site frame the app, though the app may frame itself", () => {
    expect(byKey["Content-Security-Policy"]).toBe("frame-ancestors 'self'");
    expect(byKey["X-Frame-Options"]).toBe("SAMEORIGIN");
  });

  it("stop type sniffing, trim the referrer, and ask for no device APIs", () => {
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(byKey["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=(), payment=()");
  });

  it("don't announce the framework", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
