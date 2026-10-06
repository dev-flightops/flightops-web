import { describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({ apiFetch: vi.fn() }));
vi.mock("./weather", () => ({ batchWeather: vi.fn() }));

import { riskStops, type AirportInfo } from "./dispatch-risk";
import type { WeatherBatchResponse, WeatherReportResponse } from "./types";

function report(icao: string, kind: string, raw: string): WeatherReportResponse {
  return {
    icao,
    kind,
    raw,
    parsed_at: "2026-10-06T16:00:00Z",
    valid_until: "2026-10-06T16:05:00Z",
    cache_hit: false,
  } as WeatherReportResponse;
}

const PABE: AirportInfo = {
  ident: "PABE",
  found: true,
  name: "BETHEL/BETHEL",
  latitude: 60.7786,
  longitude: -161.8372,
  elevation_ft: 128,
  runways: [
    { name: "01L/19R", length_ft: 6400, width_ft: 150, surface: "A", true_alignment_deg: 23 },
  ],
};

describe("riskStops (#50)", () => {
  it("hands ops each stop's reports and airport record", () => {
    const weather: WeatherBatchResponse = {
      items: [
        report("PABE", "metar", "PABE 131600Z 34009KT 10SM CLR"),
        report("PABE", "taf", "TAF PABE 131121Z P6SM SKC"),
        report("PABE", "pirep", ""),
        report("A61", "pirep", "BET UA /OV A61/IC MOD RIME"),
      ],
      errors: [{ icao: "A61", kind: "metar", status: 400, detail: "icao must be 4 chars" }],
    };
    const airports: AirportInfo[] = [
      PABE,
      { ...PABE, ident: "A61", found: false, latitude: null, longitude: null, runways: [] },
    ];

    expect(riskStops(["PABE", "A61"], weather, airports)).toEqual([
      {
        ident: "PABE",
        metar: "PABE 131600Z 34009KT 10SM CLR",
        taf: "TAF PABE 131121Z P6SM SKC",
        // None reported is an answer: the empty string, not "unavailable".
        pireps: "",
        airport: {
          found: true,
          latitude: 60.7786,
          longitude: -161.8372,
          runways: [{ name: "01L/19R", length_ft: 6400, width_ft: 150, true_alignment_deg: 23 }],
        },
      },
      {
        ident: "A61",
        metar: null,
        taf: null,
        pireps: "BET UA /OV A61/IC MOD RIME",
        airport: { found: false, latitude: null, longitude: null, runways: [] },
      },
    ]);
  });

  it("sends nothing it doesn't have when the weather service is down", () => {
    expect(riskStops(["PABE"], null, null)).toEqual([
      { ident: "PABE", metar: null, taf: null, pireps: null },
    ]);
  });
});
