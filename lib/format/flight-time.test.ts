import { describe, expect, it } from "vitest";

import { formatBoth, formatLocal, formatZulu, formatZuluDateTime, formatZuluDate } from "./flight-time";

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

describe("formatZuluDateTime", () => {
  it("carries the date and the zulu suffix", () => {
    expect(formatZuluDateTime("2026-08-26T00:13:57Z")).toBe("Aug 26, 00:13z");
  });

  it("reports the UTC calendar day, not the host's", () => {
    // 2026-08-26T00:13Z is still Aug 25 in Anchorage. A duty record has
    // to name the day the clock actually says, not the reader's.
    expect(formatZuluDateTime("2026-08-26T00:13:57Z")).toContain("Aug 26");
  });

  it("does not drift with the host zone", () => {
    // The bug this replaces: toLocaleString with no timeZone rendered in
    // whatever zone the process happened to run in.
    const out = formatZuluDateTime("2026-08-26T17:15:00Z");
    expect(out).toBe("Aug 26, 17:15z");
  });

  it("returns the input rather than 'Invalid Date' on junk", () => {
    expect(formatZuluDateTime("nonsense")).toBe("nonsense");
  });
});

describe("formatZuluDate", () => {
  it("names the UTC calendar day", () => {
    expect(formatZuluDate("2026-08-07T09:00:00Z")).toBe("Aug 7, 2026");
  });

  it("does not slip to the previous day near midnight UTC", () => {
    // 00:13Z is still Aug 25 in Anchorage. A certificate expiry has to
    // name the day it actually expires, not the reader's day.
    expect(formatZuluDate("2026-08-26T00:13:00Z")).toBe("Aug 26, 2026");
  });

  it("does not slip forward from the other side either", () => {
    expect(formatZuluDate("2026-08-26T23:47:00Z")).toBe("Aug 26, 2026");
  });

  it("returns the input rather than 'Invalid Date' on junk", () => {
    expect(formatZuluDate("nonsense")).toBe("nonsense");
  });
});
