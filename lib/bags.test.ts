import { describe, expect, it } from "vitest";

import { aboard, bagInputs, bagLine, bagsFromForm, bagsSummary, draftsFrom, type Bag } from "./bags";

const BAGS: Bag[] = [
  { id: "b-1", weight_lbs: "40.0", carry_on: false, description: "Black duffel, red tag", status: "aboard" },
  { id: "b-2", weight_lbs: "12.5", carry_on: true, description: null, status: "aboard" },
  { id: "b-3", weight_lbs: "25.0", carry_on: false, description: "Blue cooler", status: "bumped" },
];

describe("a passenger's bags, one by one (the client, 18 Nov)", () => {
  it("says what they come to, the carry-on weight on its own", () => {
    expect(bagsSummary(aboard(BAGS))).toBe("2 bags, 52.5 lb (1 carry-on, 12.5 lb)");
    expect(bagsSummary([{ weight_lbs: "30", carry_on: false }])).toBe("1 bag, 30 lb");
    expect(bagsSummary([])).toBe("No bags");
  });

  it("lists a bag with what it looks like", () => {
    expect(bagLine(BAGS[0])).toBe("40 lb: Black duffel, red tag");
    expect(bagLine(BAGS[1])).toBe("12.5 lb, carry-on");
  });

  it("edits the bags aboard, not the bumped ones", () => {
    const drafts = draftsFrom(BAGS);
    expect(drafts.map((d) => [d.key, d.weight, d.carryOn, d.description])).toEqual([
      ["b-1", "40", false, "Black duffel, red tag"],
      ["b-2", "12.5", true, ""],
    ]);
    expect(bagInputs(drafts)).toEqual([
      { weight_lbs: 40, carry_on: false, description: "Black duffel, red tag" },
      { weight_lbs: 12.5, carry_on: true, description: null },
    ]);
  });

  it("reads the bags a form posted, and refuses what doesn't hold up", () => {
    expect(bagsFromForm(null)).toBeNull();
    expect(bagsFromForm("")).toBeNull();
    expect(bagsFromForm("[]")).toEqual([]);
    expect(bagsFromForm(JSON.stringify([{ weight_lbs: 20, carry_on: true, description: "  Red case " }]))).toEqual([
      { weight_lbs: 20, carry_on: true, description: "Red case" },
    ]);
    expect(bagsFromForm("not json")).toBe("invalid");
    expect(bagsFromForm(JSON.stringify([{ weight_lbs: -1 }]))).toBe("invalid");
    expect(bagsFromForm(JSON.stringify([{ weight_lbs: 1500 }, { weight_lbs: 600 }]))).toBe("invalid");
    expect(bagsFromForm(JSON.stringify([{ weight_lbs: 10, description: "x".repeat(201) }]))).toBe("invalid");
    expect(bagsFromForm(JSON.stringify(Array.from({ length: 51 }, () => ({ weight_lbs: 1 }))))).toBe("invalid");
  });
});
