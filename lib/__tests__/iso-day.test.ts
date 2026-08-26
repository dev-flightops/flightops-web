import { describe, expect, it } from "vitest";

import {
  describeIsoDay,
  formatIsoDay,
  isValidIsoDay,
  isoDayDiff,
  shiftIsoDay,
  todayIsoDay,
} from "../iso-day";

describe("shiftIsoDay", () => {
  it("moves a day in each direction", () => {
    expect(shiftIsoDay("2026-08-20", 1)).toBe("2026-08-21");
    expect(shiftIsoDay("2026-08-20", -1)).toBe("2026-08-19");
    expect(shiftIsoDay("2026-08-20", 0)).toBe("2026-08-20");
  });

  it("rolls over months, years and leap days", () => {
    expect(shiftIsoDay("2026-08-31", 1)).toBe("2026-09-01");
    expect(shiftIsoDay("2026-09-01", -1)).toBe("2026-08-31");
    expect(shiftIsoDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftIsoDay("2027-01-01", -1)).toBe("2026-12-31");
    expect(shiftIsoDay("2024-02-28", 1)).toBe("2024-02-29");
    expect(shiftIsoDay("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("survives a DST boundary", () => {
    // US DST ends 2026-11-01. A local-midnight implementation lands on
    // 23:00 the previous day here and reports the wrong date.
    expect(shiftIsoDay("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftIsoDay("2026-11-01", 1)).toBe("2026-11-02");
    expect(shiftIsoDay("2026-03-08", 1)).toBe("2026-03-09");
  });

  it("leaves malformed input alone rather than inventing a date", () => {
    expect(shiftIsoDay("not-a-day", 1)).toBe("not-a-day");
  });
});

describe("the reported bug: forward arrow was a no-op", () => {
  // https://flightops-web.vercel.app/reservations/fleet-board?d=2026-08-20
  // rendered "Wed, Aug 19" and the → arrow did nothing, because the client
  // recomputed the day from a UTC instant using local getters.
  const CURRENT = "2026-08-20";

  it("advances to a URL different from the one being viewed", () => {
    const next = shiftIsoDay(CURRENT, 1);
    expect(next).not.toBe(CURRENT); // the whole bug, in one assertion
    expect(next).toBe("2026-08-21");
  });

  it("steps by exactly one day in both directions", () => {
    expect(isoDayDiff(CURRENT, shiftIsoDay(CURRENT, 1))).toBe(1);
    expect(isoDayDiff(CURRENT, shiftIsoDay(CURRENT, -1))).toBe(-1);
  });

  it("labels the day named in the URL, not its neighbour", () => {
    // Holds in every zone — that is the point. Under the old code this
    // read "Wed, Aug 19" for any viewer at a negative UTC offset.
    expect(formatIsoDay(CURRENT)).toContain("20");
    expect(formatIsoDay(CURRENT)).toContain("Aug");
    expect(formatIsoDay(CURRENT)).toContain("Thu");
  });

  it("round-trips a walk forward and back to where it started", () => {
    let cursor = CURRENT;
    for (let i = 0; i < 10; i += 1) cursor = shiftIsoDay(cursor, 1);
    for (let i = 0; i < 10; i += 1) cursor = shiftIsoDay(cursor, -1);
    expect(cursor).toBe(CURRENT);
  });
});

describe("isoDayDiff", () => {
  it("counts whole days across a month boundary", () => {
    expect(isoDayDiff("2026-08-30", "2026-09-02")).toBe(3);
    expect(isoDayDiff("2026-09-02", "2026-08-30")).toBe(-3);
    expect(isoDayDiff("2026-08-20", "2026-08-20")).toBe(0);
  });
});

describe("describeIsoDay", () => {
  const TODAY = "2026-08-24";

  it("uses relative wording only for the adjacent days", () => {
    expect(describeIsoDay("2026-08-24", TODAY)).toMatch(/^Today — /);
    expect(describeIsoDay("2026-08-25", TODAY)).toMatch(/^Tomorrow — /);
    expect(describeIsoDay("2026-08-23", TODAY)).toMatch(/^Yesterday — /);
    expect(describeIsoDay("2026-08-27", TODAY)).not.toMatch(/—/);
  });
});

describe("isValidIsoDay", () => {
  it("accepts real dates", () => {
    expect(isValidIsoDay("2026-08-20")).toBe(true);
    expect(isValidIsoDay("2024-02-29")).toBe(true);
  });

  it("rejects malformed and non-existent dates", () => {
    expect(isValidIsoDay(undefined)).toBe(false);
    expect(isValidIsoDay("")).toBe(false);
    expect(isValidIsoDay("2026-8-5")).toBe(false);
    expect(isValidIsoDay("2026-13-01")).toBe(false);
    expect(isValidIsoDay("2026-02-30")).toBe(false);
    expect(isValidIsoDay("2026-08-20T00:00:00")).toBe(false);
  });
});

describe("todayIsoDay", () => {
  // This one is deliberately zone-dependent: "Today" has to mean the
  // viewer's today. So it asserts the property rather than a fixed answer,
  // and holds in every zone the suite might run in.
  it("reads the viewer's local calendar day", () => {
    const instant = new Date("2026-08-20T02:00:00Z");
    const pad = (n: number) => String(n).padStart(2, "0");
    expect(todayIsoDay(instant)).toBe(
      `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-` +
        `${pad(instant.getDate())}`,
    );
  });

  it("does not simply echo the UTC day", () => {
    // West of Greenwich, 02:00Z is still the previous local day. Where the
    // offset makes them agree there is nothing to distinguish, so skip.
    const instant = new Date("2026-08-20T02:00:00Z");
    if (instant.getTimezoneOffset() > 0) {
      expect(todayIsoDay(instant)).toBe("2026-08-19");
    }
  });
});
