import { describe, expect, it } from "vitest";

import { fuelUnitOf, oilLowOption, OIL_QUARTS_LOW, readingParts } from "./fuel-reading";

describe("fuel and oil readings (the client, 17 Nov)", () => {
  it("reads a turbine in pounds and quarts low", () => {
    expect(readingParts({ fuel_lbs: "2100.0", oil_quarts_low: "2.0" })).toEqual(["2,100 lb", "oil 2 qt low"]);
    expect(readingParts({ fuel_lbs: 2100, oil_quarts_low: 0 })).toEqual(["2,100 lb", "oil full"]);
  });

  it("reads a piston in gallons and quarts in the sump, as before", () => {
    expect(readingParts({ fuel_gallons: "60.0", oil_quarts: "9.0" })).toEqual(["60 gal", "9 qt oil"]);
  });

  it("shows what was recorded, and nothing when nothing was", () => {
    expect(readingParts({ fuel_gallons: "60.0", fuel_lbs: null, oil_quarts_low: null })).toEqual(["60 gal"]);
    expect(readingParts({})).toEqual([]);
  });

  it("offers full, then -1, -2, -3 … quarts low", () => {
    expect(OIL_QUARTS_LOW.map(oilLowOption)).toEqual(["Full", "-1", "-2", "-3", "-4", "-5"]);
  });

  it("takes an older service's missing unit as gallons", () => {
    expect([fuelUnitOf("lb"), fuelUnitOf("gal"), fuelUnitOf(undefined), fuelUnitOf(null)]).toEqual([
      "lb",
      "gal",
      "gal",
      "gal",
    ]);
  });
});
