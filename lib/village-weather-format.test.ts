import { describe, expect, it } from "vitest";

import { scoredElsewhere } from "@/components/weather/weather-source";
import type { StopWeather } from "@/lib/api/dispatch-risk";
import type { VillageWeatherReportResponse } from "@/lib/api/types";

import { villageCategoryBecause, villageCrosswind, villageRunways, villageWind } from "./village-weather-format";

function report(over: Partial<VillageWeatherReportResponse>): VillageWeatherReportResponse {
  return {
    id: "r1",
    village_airport_id: "a1",
    reported_by: null,
    reported_by_name: "Peregrine Admin",
    reported_at: "2026-10-28T13:44:00Z",
    cloud_cover: null,
    ceiling_ft: null,
    visibility_sm: null,
    wind_dir_deg: null,
    wind_speed_kt: null,
    wind_gust_kt: null,
    temperature_c: null,
    altimeter_in_hg: null,
    notes: null,
    flight_category: null,
    ...over,
  };
}

describe("villageCategoryBecause (#149)", () => {
  it("says a FEW 400, 3 SM report is MVFR on its visibility, not its clouds", () => {
    // The client's Levelock report, 28 Oct, read as "actually VFR".
    const levelock = report({ cloud_cover: "FEW", ceiling_ft: 400, visibility_sm: 3, flight_category: "MVFR" });
    expect(villageCategoryBecause(levelock)).toBe("visibility 3 SM");
  });

  it("names a broken layer as the ceiling that set it", () => {
    expect(
      villageCategoryBecause(report({ cloud_cover: "BKN", ceiling_ft: 800, visibility_sm: 10, flight_category: "IFR" })),
    ).toBe("ceiling 800 ft");
  });

  it("names both when both set it", () => {
    expect(
      villageCategoryBecause(report({ cloud_cover: "OVC", ceiling_ft: 2500, visibility_sm: 4, flight_category: "MVFR" })),
    ).toBe("ceiling 2,500 ft and visibility 4 SM");
  });

  it("takes a base with no cover as a ceiling, as the weather service does", () => {
    expect(
      villageCategoryBecause(report({ ceiling_ft: 1200, visibility_sm: 10, flight_category: "MVFR" })),
    ).toBe("ceiling 1,200 ft");
  });

  it("says nothing for VFR, or with nothing reported", () => {
    expect(villageCategoryBecause(report({ visibility_sm: 10, flight_category: "VFR" }))).toBeNull();
    expect(villageCategoryBecause(report({}))).toBeNull();
  });
});

// The client, 11/13 (LOG-38): agents give the wind as a compass point.
describe("a village wind", () => {
  it("reads as the agent gave it, a compass point", () => {
    expect(villageWind(report({ wind_dir_deg: 45, wind_dir_compass: "NE", wind_speed_kt: 15, wind_gust_kt: 22 }))).toBe(
      "Wind NE/15ktG22",
    );
  });

  it("or in degrees, as before", () => {
    expect(villageWind(report({ wind_dir_deg: 50, wind_speed_kt: 20 }))).toBe("Wind 050°/20kt");
  });
});

describe("scoredElsewhere", () => {
  const stop = (over: Partial<StopWeather>): StopWeather => ({
    ident: "9Z8",
    source: "village",
    certified: false,
    described: "Village report, not certified",
    ceiling_ft: null,
    ceiling_from: null,
    visibility_sm: null,
    visibility_from: null,
    wind_direction: null,
    wind_kt: null,
    wind_gust_kt: null,
    wind_from: null,
    ...over,
  });

  it("says no ceiling, not clear, when the village reported clouds that aren't one (#149)", () => {
    expect(
      scoredElsewhere(
        stop({ ceiling_from: "village report", visibility_sm: 3, visibility_from: "village report" }),
      ),
    ).toEqual(["No ceiling (village report)", "Visibility 3 SM (village report)"]);
  });

  it("gives an agent's compass point without a degree sign (LOG-38)", () => {
    expect(scoredElsewhere(stop({ wind_direction: "NE", wind_kt: 20, wind_from: "village report" }))).toEqual([
      "Wind NE @ 20 kt (village report)",
    ]);
    expect(scoredElsewhere(stop({ wind_direction: "045", wind_kt: 20, wind_from: "village report" }))).toEqual([
      "Wind 045° @ 20 kt (village report)",
    ]);
  });

  it("gives the ceiling when there is one", () => {
    expect(scoredElsewhere(stop({ ceiling_ft: 800, ceiling_from: "village report" }))).toEqual([
      "Ceiling 800 ft (village report)",
    ]);
  });
});

describe("a village airport's runway and crosswind (#171)", () => {
  it("one runway, with its size", () => {
    expect(villageRunways([{ name: "01/19", length_ft: 3284, width_ft: 60, true_alignment_deg: 26 }])).toBe(
      "Runway 01/19, 3,284 × 60 ft",
    );
  });

  it("several, by name", () => {
    expect(
      villageRunways([
        { name: "01L/19R", length_ft: 6400, width_ft: 150, true_alignment_deg: 23 },
        { name: "12/30", length_ft: 1858, width_ft: 75, true_alignment_deg: 128 },
      ]),
    ).toBe("Runways 01L/19R, 12/30");
  });

  it("none on file", () => {
    expect(villageRunways([])).toBeNull();
    expect(villageRunways(undefined)).toBeNull();
  });

  it("the crosswind, with its runway", () => {
    expect(villageCrosswind({ crosswind_kt: 13, crosswind_runway: "01/19" })).toBe("Crosswind 13 kt on 01/19");
    expect(villageCrosswind({ crosswind_kt: 0, crosswind_runway: "01/19" })).toBe("Crosswind 0 kt on 01/19");
  });

  it("no crosswind when there's nothing to work it out from", () => {
    expect(villageCrosswind({ crosswind_kt: null, crosswind_runway: null })).toBeNull();
    expect(villageCrosswind({})).toBeNull();
  });
});
