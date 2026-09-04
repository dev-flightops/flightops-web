import { describe, expect, it } from "vitest";

import {
  describeIsoDay,
  formatIsoDay,
  formatIsoDayLong,
  isValidIsoDay,
  isoDayDiff,
  isoDayToUtcDate,
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

describe("isoDayToUtcDate", () => {
  it("anchors the day at UTC midnight", () => {
    const d = isoDayToUtcDate("2026-08-26")!;
    expect(d.toISOString()).toBe("2026-08-26T00:00:00.000Z");
  });

  it("renders the day it was given, in every host zone", () => {
    // The bug this exists to prevent: `new Date("2026-08-26T00:00:00")`
    // parses in the host's zone, and the pages then format with
    // timeZone: "UTC". Parsed local, rendered UTC — so a host east of
    // Greenwich rendered the day before. A pay event dated the 26th
    // displayed as the 25th.
    const rendered = isoDayToUtcDate("2026-08-26")!.toLocaleDateString(
      "en-US",
      { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" },
    );
    expect(rendered).toBe("Aug 26, 2026");
  });

  it("round-trips every day of a month", () => {
    for (let day = 1; day <= 31; day += 1) {
      const iso = `2026-01-${String(day).padStart(2, "0")}`;
      expect(isoDayToUtcDate(iso)!.toISOString().slice(0, 10)).toBe(iso);
    }
  });

  it("survives the DST boundaries that trip local parsing", () => {
    for (const iso of ["2026-03-08", "2026-11-01", "2026-10-31"]) {
      expect(isoDayToUtcDate(iso)!.toISOString().slice(0, 10)).toBe(iso);
    }
  });

  it("returns null rather than an Invalid Date", () => {
    // Callers render a dash on null. Returning an invalid Date would
    // print "Invalid Date" into a payroll table.
    expect(isoDayToUtcDate(undefined)).toBeNull();
    expect(isoDayToUtcDate(null)).toBeNull();
    expect(isoDayToUtcDate("")).toBeNull();
    expect(isoDayToUtcDate("2026-02-30")).toBeNull();
    expect(isoDayToUtcDate("not-a-date")).toBeNull();
    expect(isoDayToUtcDate("2026-08-26T00:00:00")).toBeNull();
  });
});

describe("formatIsoDayLong", () => {
  const inZone = <T>(tz: string, fn: () => T): T => {
    const previous = process.env.TZ;
    process.env.TZ = tz;
    try {
      return fn();
    } finally {
      process.env.TZ = previous;
    }
  };

  it("renders the day it was given, in every zone", () => {
    // Tokyo is +9 and Anchorage -8. Parsing a bare YYYY-MM-DD in the host
    // zone breaks going east; rendering a UTC instant without
    // timeZone:"UTC" breaks going west. Running only in UTC hides both.
    for (const tz of ["UTC", "Asia/Tokyo", "America/Anchorage"]) {
      expect(
        inZone(tz, () => formatIsoDayLong("2026-08-01")),
        `shifted under TZ=${tz}`,
      ).toBe("Aug 1, 2026");
    }
  });

  it("keeps the year, which is the point of the long form", () => {
    expect(formatIsoDayLong("2019-12-31")).toBe("Dec 31, 2019");
  });

  it("returns the input unchanged when it is not a plain day", () => {
    expect(formatIsoDayLong("2026-08-01T12:00:00Z")).toBe(
      "2026-08-01T12:00:00Z",
    );
    expect(formatIsoDayLong("nonsense")).toBe("nonsense");
  });
});
