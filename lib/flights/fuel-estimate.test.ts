import { describe, expect, it } from "vitest";

import type { FuelEstimate } from "@/lib/api/manifest";

import { fuelPlanningNote } from "./fuel-estimate";

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
