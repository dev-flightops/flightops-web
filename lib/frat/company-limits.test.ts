import { describe, expect, it } from "vitest";

import {
  companyCrosswindLimitKt,
  nearLimitEntryKt,
} from "./company-limits";

/** The operator's own numbers, which ship as the defaults. */
const limits = {
  crosswind_single_engine_kt: 30,
  crosswind_multi_engine_kt: 35,
  crosswind_near_margin_kt: 10,
};

describe("companyCrosswindLimitKt", () => {
  it("picks 30 for a single", () => {
    expect(companyCrosswindLimitKt(limits, 1)).toBe(30);
  });

  it("picks 35 for a twin", () => {
    expect(companyCrosswindLimitKt(limits, 2)).toBe(35);
  });

  it("treats anything above one engine as multi", () => {
    // "multi" is not "twin" — the limit is keyed on more-than-one.
    expect(companyCrosswindLimitKt(limits, 4)).toBe(35);
  });

  it("returns null when the engine count is not recorded", () => {
    // Not defaulted either way. The lower limit would show the pilot a
    // stricter number than policy, the higher a looser one.
    expect(companyCrosswindLimitKt(limits, null)).toBeNull();
    expect(companyCrosswindLimitKt(limits, undefined)).toBeNull();
  });

  it("treats a nonsense engine count as unknown", () => {
    expect(companyCrosswindLimitKt(limits, 0)).toBeNull();
  });

  it("follows the tenant's own configuration", () => {
    // "This will all change company to company."
    const tighter = {
      crosswind_single_engine_kt: 20,
      crosswind_multi_engine_kt: 25,
      crosswind_near_margin_kt: 5,
    };
    expect(companyCrosswindLimitKt(tighter, 1)).toBe(20);
    expect(companyCrosswindLimitKt(tighter, 2)).toBe(25);
  });
});

describe("nearLimitEntryKt", () => {
  it("is the limit less the margin", () => {
    // "Within 10 knots of a limit is near" — so 20 kt on a single.
    expect(nearLimitEntryKt(limits, 1)).toBe(20);
    expect(nearLimitEntryKt(limits, 2)).toBe(25);
  });

  it("moves with the margin", () => {
    expect(
      nearLimitEntryKt({ ...limits, crosswind_near_margin_kt: 5 }, 1),
    ).toBe(25);
  });

  it("is null when no limit applies", () => {
    expect(nearLimitEntryKt(limits, null)).toBeNull();
  });

  it("agrees with the Python scorer's bands on the shipped numbers", () => {
    // frat_limits.py scores 20-30 as near and above 30 as over, for a
    // single on 30/10. Same two boundaries, derived here for display.
    // If these drift apart the pilot is told one thing and scored
    // another, which is the reason that module says to delete this one.
    expect(nearLimitEntryKt(limits, 1)).toBe(20);
    expect(companyCrosswindLimitKt(limits, 1)).toBe(30);
  });
});
