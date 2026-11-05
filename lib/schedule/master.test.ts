import { describe, expect, it } from "vitest";

import { daysText, isRoundTrip, legsRoute, nextDay, previousDay } from "./master";

const leg = (origin: string, destination: string) => ({ origin, destination, departs: "09:00", arrives: "10:00" });

describe("daysText", () => {
  it("names the usual weeks, as legacy did", () => {
    expect(daysText([0, 1, 2, 3, 4, 5, 6])).toBe("Daily");
    expect(daysText([0, 1, 2, 3, 4])).toBe("Mon–Fri");
    expect(daysText([5, 6])).toBe("Sat–Sun");
  });

  it("lists any other days in order", () => {
    expect(daysText([4, 0, 2])).toBe("Mon · Wed · Fri");
    expect(daysText([6])).toBe("Sun");
  });
});

describe("legs", () => {
  it("writes the route with every stop", () => {
    expect(legsRoute([leg("PANC", "PABE"), leg("PABE", "PANC")])).toBe("PANC → PABE → PANC");
    expect(legsRoute([leg("PANC", "PABE")])).toBe("PANC → PABE");
    expect(legsRoute([])).toBe("");
  });

  it("knows a round trip", () => {
    expect(isRoundTrip([leg("PANC", "PABE"), leg("PABE", "PANC")])).toBe(true);
    expect(isRoundTrip([leg("PANC", "PABE"), leg("PABE", "PAKN")])).toBe(false);
    expect(isRoundTrip([leg("PANC", "PANC")])).toBe(false);
  });
});

describe("days", () => {
  it("moves across a month and a year", () => {
    expect(nextDay("2026-11-30")).toBe("2026-12-01");
    expect(previousDay("2027-01-01")).toBe("2026-12-31");
  });
});
