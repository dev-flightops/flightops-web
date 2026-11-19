import { describe, expect, it } from "vitest";

import type { FuelEstimate } from "@/lib/api/manifest";

import { fuelEstimateLine, fuelPlanningNote } from "./fuel-estimate";

const ESTIMATE: FuelEstimate = {
  lbs: "754",
  gallons: "112.5",
  burn_gph: "54",
  fuel_type_code: "jet_a",
  flight_minutes: 40,
  round_trip: true,
  reserve_minutes: 45,
  missing: [],
};

describe("fuelPlanningNote (#126)", () => {
  it("says the reserve holds on every flight", () => {
    expect(fuelPlanningNote(ESTIMATE, { is_ifr: false })).toBe(
      "The 45 min reserve holds on every flight: never below the legal minimum, as the GOM asks for conservative planning.",
    );
  });

  it("tells an IFR flight to add its alternate", () => {
    expect(fuelPlanningNote(ESTIMATE, { is_ifr: true })).toMatch(
      / IFR: add the fuel to your alternate, which the GOM says always to plan for\.$/,
    );
  });
});

describe("an IFR flight's alternate (#201)", () => {
  const IFR: FuelEstimate = {
    ...ESTIMATE,
    flight_minutes: 55,
    lbs: "1328",
    gallons: "198.2",
    burn_gph: "58",
    ifr: true,
    alternate: "PABE",
    alternate_minutes: 50,
    alternate_missing: null,
  };

  it("is flown in the estimate", () => {
    expect(fuelEstimateLine(IFR)).toBe(
      "Fuel estimated: round trip, 55 min each way (no Jet A at the destination) + 50 min to the alternate PABE + 45 min reserve at 58 gal/h = 198.2 gal of Jet A.",
    );
    expect(fuelPlanningNote(IFR)).toMatch(/ IFR: the fuel to the alternate PABE is in it, as the GOM always plans\.$/);
  });

  it("says what the estimate still needs to carry it", () => {
    const named = { ...IFR, alternate: null, alternate_minutes: null, alternate_missing: "the alternate airport (Edit flight, or the pilot's Flight rules)" };
    expect(fuelEstimateLine(named)).not.toMatch(/alternate/);
    expect(fuelPlanningNote(named)).toMatch(
      / IFR: the fuel to the alternate isn't in it yet; it needs the alternate airport \(Edit flight, or the pilot's Flight rules\)\.$/,
    );
  });

  it("leaves a VFR flight's line as it was", () => {
    expect(fuelEstimateLine(ESTIMATE)).toBe(
      "Fuel estimated: round trip, 40 min each way (no Jet A at the destination) + 45 min reserve at 54 gal/h = 112.5 gal of Jet A.",
    );
  });
});
