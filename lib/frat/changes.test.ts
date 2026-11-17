import { describe, expect, it } from "vitest";

import { changeLines, changeSummary, factorChangeLine } from "./changes";

/** What a FRAT changed since the other side last saw it, in words (17 Nov). */
describe("FRAT changes in words", () => {
  it("says each factor as the questionnaire names it, with a dash where a version doesn't have it", () => {
    expect(factorChangeLine({ code: "pilot_rest", before: 1, after: 3 })).toBe("Rest in last 24h: 1 → 3");
    expect(factorChangeLine({ code: "route_terrain", before: 3, after: null })).toBe("Terrain challenge: 3 → —");
    expect(factorChangeLine({ code: "made_up", before: null, after: 2 })).toBe("made_up: — → 2");
  });

  it("lists the factors in the questionnaire's order, retired ones last, then the mitigation", () => {
    expect(
      changeLines({
        factors: [
          { code: "route_terrain", before: 3, after: null },
          { code: "wx_wind", before: 0, after: 2 },
          { code: "pilot_rest", before: 1, after: 3 },
        ],
        mitigations_before: "Watch the wind",
        mitigations_after: "Leaving before the front",
      }),
    ).toEqual([
      "Rest in last 24h: 1 → 3",
      "Wind & gusts: 0 → 2",
      "Terrain challenge: 3 → —",
      "Mitigation: “Watch the wind” → “Leaving before the front”",
    ]);
  });

  it("says a mitigation added or removed", () => {
    expect(changeLines({ factors: [], mitigations_before: null, mitigations_after: "Briefed" })).toEqual([
      "Mitigation added: “Briefed”",
    ]);
    expect(changeLines({ factors: [], mitigations_before: "Briefed", mitigations_after: null })).toEqual([
      "Mitigation removed (was “Briefed”)",
    ]);
    expect(changeLines({ factors: [], mitigations_before: null, mitigations_after: null })).toEqual([]);
  });

  it("sums a hand-off up in one line", () => {
    const four = [
      { code: "wx_wind", before: 0, after: 2 },
      { code: "pilot_rest", before: 1, after: 3 },
      { code: "wx_ceiling", before: 2, after: 4 },
      { code: "wx_vis", before: 0, after: 1 },
    ];
    expect(changeSummary(four.slice(0, 2), false)).toBe("Rest in last 24h 1 → 3, Wind & gusts 0 → 2");
    expect(changeSummary(four, true)).toMatch(/^Rest in last 24h 1 → 3, .+ and 1 more, and the mitigation$/);
    expect(changeSummary([], true)).toBe("the mitigation");
    expect(changeSummary(undefined, false)).toBe("no score changed");
  });
});
