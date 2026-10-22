import { describe, expect, it } from "vitest";

import type { MinimumsStation } from "@/lib/api/types";

import { belowMinimumsFromError, belowSummary, minimumsLabel } from "./weather-minimums";

const STATIONS: MinimumsStation[] = [
  {
    icao: "PABE",
    below: false,
    observations: [
      {
        source: "metar",
        observed_at: null,
        ceiling_ft: 800,
        visibility_sm: 3,
        below_ceiling: false,
        below_visibility: false,
      },
    ],
  },
  {
    icao: "PAEM",
    below: true,
    observations: [
      {
        source: "metar",
        observed_at: null,
        ceiling_ft: 3000,
        visibility_sm: 1.75,
        below_ceiling: false,
        below_visibility: true,
      },
      {
        source: "field_report",
        observed_at: null,
        ceiling_ft: 400,
        visibility_sm: 5,
        below_ceiling: true,
        below_visibility: false,
      },
    ],
  },
];

describe("dispatch minimums in words (#89)", () => {
  it("labels the minimums the way the GOM writes them", () => {
    expect(minimumsLabel(600, "2.0")).toBe("600 ft / 2 sm");
    expect(minimumsLabel(1000, 2.5)).toBe("1,000 ft / 2.5 sm");
  });

  it("names only the stops below, and only what is below at each", () => {
    expect(belowSummary(STATIONS)).toBe(
      "PAEM visibility 1.75 sm; ceiling 400 ft (village report)",
    );
  });

  it("reads release's refusal", () => {
    const body = JSON.stringify({
      detail: {
        error: "below_weather_minimums",
        min_ceiling_ft: 600,
        min_visibility_sm: 2,
        stations: STATIONS.filter((s) => s.below),
      },
    });
    expect(belowMinimumsFromError(body)).toMatch(
      /^Below the company's dispatch minimums for aircraft not IFR certified \(600 ft \/ 2 sm\): PAEM visibility 1\.75 sm/,
    );
  });

  it("gives up on anything else", () => {
    expect(belowMinimumsFromError("not json")).toBeNull();
    expect(belowMinimumsFromError(JSON.stringify({ detail: { error: "other" } }))).toBeNull();
  });
});
