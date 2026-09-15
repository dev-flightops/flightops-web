import { describe, expect, it } from "vitest";

import { simFilename } from "./filename";

/**
 * The saved filename.
 *
 * `apiFetch` parses the body and does not surface response headers, so
 * the Content-Disposition name reports-service sends cannot be read
 * here and this is the second construction site for one filename. The
 * scheme is pinned on both sides; these tests are the web half.
 *
 * Legacy's filename is `GV_SIM_{start}_{end}.{ext}` with the carrier
 * hardcoded, and identical for all three of its targets — so an OAG
 * schedule and an accounting extract saved to the same name and
 * overwrote each other in the downloads folder.
 */

describe("simFilename", () => {
  it("names the carrier, the basis, the window and the format", () => {
    expect(
      simFilename("PG", "schedule", "2026-09-01", "2026-09-08", "csv"),
    ).toBe("PG_schedule_2026-09-01_2026-09-08.csv");
  });

  it("distinguishes the two bases over the same window", () => {
    // Legacy's three targets all produced one filename, so the second
    // download silently replaced the first.
    const window = ["2026-09-01", "2026-09-08"] as const;
    expect(simFilename("PG", "schedule", ...window, "csv")).not.toBe(
      simFilename("PG", "flights", ...window, "csv"),
    );
  });

  it("gives the fixed-width file the .sim extension", () => {
    expect(
      simFilename("PG", "schedule", "2026-09-01", "2026-09-08", "fixed"),
    ).toMatch(/\.sim$/);
  });

  it("carries the operator's own code, not a constant", () => {
    expect(
      simFilename("ABX", "schedule", "2026-09-01", "2026-09-08", "xml"),
    ).toBe("ABX_schedule_2026-09-01_2026-09-08.xml");
  });
});
