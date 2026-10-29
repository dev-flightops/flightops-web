import { describe, expect, it } from "vitest";

import { scoredElsewhere } from "@/components/weather/weather-source";
import type { StopWeather } from "@/lib/api/dispatch-risk";
import type { VillageWeatherReportResponse } from "@/lib/api/types";

import { villageCategoryBecause } from "./village-weather-format";

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

  it("gives the ceiling when there is one", () => {
    expect(scoredElsewhere(stop({ ceiling_ft: 800, ceiling_from: "village report" }))).toEqual([
      "Ceiling 800 ft (village report)",
    ]);
  });
});
