import { describe, expect, it } from "vitest";

import {
  humanise,
  locationOf,
  openCount,
  tally,
  withinWindow,
  type Report,
} from "./report-stats";

function report(over: Partial<Report> = {}): Report {
  return {
    category: "ground_ops",
    status: "submitted",
    created_at: "2026-09-01T12:00:00Z",
    station: null,
    location_free_text: null,
    ...over,
  };
}

describe("open reports", () => {
  it("counts everything that is not closed", () => {
    // There is no "open" status — the statuses are submitted, triaged,
    // in_progress and closed. An earlier version filtered on
    // `status === "open"`, matched nothing, and rendered a confident
    // zero. A safety officer reading "0 open" stops looking, which
    // makes this the worst way for the number to be wrong.
    const reports = [
      report({ status: "submitted" }),
      report({ status: "triaged" }),
      report({ status: "in_progress" }),
      report({ status: "closed" }),
    ];
    expect(openCount(reports)).toBe(3);
  });

  it("is zero only when everything really is closed", () => {
    expect(openCount([report({ status: "closed" })])).toBe(0);
  });

  it("is zero for an empty window", () => {
    expect(openCount([])).toBe(0);
  });
});

describe("the window", () => {
  const since = new Date("2026-06-11T00:00:00Z");

  it("keeps a report inside it", () => {
    expect(withinWindow("2026-07-01T00:00:00Z", since)).toBe(true);
  });

  it("drops one before it", () => {
    expect(withinWindow("2026-06-10T23:59:59Z", since)).toBe(false);
  });

  it("keeps one exactly on the boundary", () => {
    expect(withinWindow("2026-06-11T00:00:00Z", since)).toBe(true);
  });

  it("drops an unparseable timestamp rather than counting it", () => {
    // Counting a report we cannot date would inflate the window it
    // does not belong to.
    expect(withinWindow("not a date", since)).toBe(false);
  });
});

describe("tallying", () => {
  it("counts by key, largest first", () => {
    const rows = tally(
      [
        report({ category: "ground_ops" }),
        report({ category: "flight_ops" }),
        report({ category: "ground_ops" }),
      ],
      (r) => r.category,
    );
    expect(rows).toEqual([
      ["ground_ops", 2],
      ["flight_ops", 1],
    ]);
  });

  it("skips rows with no key rather than bucketing a blank label", () => {
    const rows = tally([report(), report()], () => null);
    expect(rows).toEqual([]);
  });

  it("does not lose a category the two report kinds do not share", () => {
    // `wildlife` exists on incidents but not on hazards. Typing the
    // shared shape as an intersection narrowed the category union to
    // the overlap and dropped it.
    const rows = tally([report({ category: "wildlife" })], (r) => r.category);
    expect(rows).toEqual([["wildlife", 1]]);
  });
});

describe("where a report happened", () => {
  it("prefers the station's ICAO", () => {
    // The same place typed freehand and picked from the station list
    // must not become two rows.
    expect(
      locationOf(
        report({
          station: { icao_code: "PANC" },
          location_free_text: "anchorage ramp",
        }),
      ),
    ).toBe("PANC");
  });

  it("falls back to what the reporter typed", () => {
    expect(locationOf(report({ location_free_text: "north apron" }))).toBe(
      "north apron",
    );
  });

  it("is null when neither is given", () => {
    expect(locationOf(report())).toBeNull();
  });
});

describe("labels", () => {
  it("turns a category code into words", () => {
    expect(humanise("ground_ops")).toBe("Ground Ops");
    expect(humanise("human_factors")).toBe("Human Factors");
  });
});
