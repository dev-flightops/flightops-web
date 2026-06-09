import { describe, expect, it } from "vitest";

import { formatBoth, formatLocal, formatZulu } from "./flight-time";

describe("formatZulu", () => {
  it("formats midday UTC as HH:MMz", () => {
    expect(formatZulu("2026-06-15T12:34:00Z")).toBe("12:34z");
  });

  it("zero-pads single-digit hours and minutes", () => {
    expect(formatZulu("2026-06-15T03:05:00Z")).toBe("03:05z");
  });

  it("handles midnight UTC", () => {
    expect(formatZulu("2026-06-15T00:00:00Z")).toBe("00:00z");
  });
});

describe("formatLocal (America/Anchorage)", () => {
  // Mid-June → AKDT (UTC-8). Use a single canonical case the rest of
  // the codebase can crib from when adding more tenants in M3.
  it("converts UTC to Anchorage local during DST", () => {
    // 20:00 UTC = 12:00 AKD in summer
    expect(formatLocal("2026-06-15T20:00:00Z")).toBe("12:00 AKD");
  });

  it("handles a wrap-back to the prior day correctly", () => {
    // 04:00 UTC = 20:00 AKD (prior day)
    expect(formatLocal("2026-06-15T04:00:00Z")).toBe("20:00 AKD");
  });
});

describe("formatBoth", () => {
  it("returns both formats", () => {
    const result = formatBoth("2026-06-15T20:00:00Z");
    expect(result.local).toBe("12:00 AKD");
    expect(result.zulu).toBe("20:00z");
  });
});
