import { describe, expect, it } from "vitest";

import {
  PLATFORM_SERVICES,
  healthPath,
  type PlatformService,
} from "./platform-services";

/**
 * The platform's service list.
 *
 * This exists because the version of it inside the System Health page
 * named six services while the platform ran sixteen, with a comment
 * claiming it mirrored the gateway. Nothing compared the two, so the
 * dashboard reported the operation healthy without ever probing ten of
 * the services it was reporting on.
 *
 * The list cannot be derived here — the gateway config is in the other
 * repo — so it is pinned, and the pin names where to check. A service
 * added backend-side fails this test rather than silently going
 * unmonitored.
 */

const EXPECTED: PlatformService[] = [
  "academy",
  "admin",
  "ai",
  "auth",
  "billing",
  "documents",
  "flight-following",
  "ground",
  "housing",
  "maintenance",
  "ops",
  "public",
  "reports",
  "reservations",
  "safety",
  "weather",
];

describe("the service list", () => {
  it("names every service the gateway proxies", () => {
    // Source of truth: flightops-services/infra/nginx/dev.conf.
    expect([...PLATFORM_SERVICES].sort()).toEqual([...EXPECTED].sort());
  });

  it("covers the whole platform, not a subset", () => {
    // The specific number matters. Six was not obviously wrong on
    // screen — it was a plausible-looking count that happened to omit
    // documents, billing, reports, safety, housing, academy, ai,
    // admin, public and reservations.
    expect(PLATFORM_SERVICES).toHaveLength(16);
  });

  it("includes the five whose health check needed a gateway fix", () => {
    // These mount their router at the gateway prefix, so
    // /documents/health was matched by `GET /documents/{document_id}`
    // and answered 401. They are in the list because dev.conf now has
    // an exact-match passthrough for each; without that they would
    // read as down.
    for (const svc of ["documents", "housing", "reports", "billing", "ai"]) {
      expect(PLATFORM_SERVICES, svc).toContain(svc);
    }
  });

  it("has no duplicates", () => {
    expect([...new Set(PLATFORM_SERVICES)]).toHaveLength(
      PLATFORM_SERVICES.length,
    );
  });

  it("is sorted, so a diff against the gateway is readable", () => {
    expect([...PLATFORM_SERVICES]).toEqual([...PLATFORM_SERVICES].sort());
  });
});

describe("healthPath", () => {
  it("is the gateway convention", () => {
    expect(healthPath("documents")).toBe("/documents/health");
  });

  it("builds a path for every service in the list", () => {
    for (const svc of PLATFORM_SERVICES) {
      expect(healthPath(svc)).toBe(`/${svc}/health`);
    }
  });
});
