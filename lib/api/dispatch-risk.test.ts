import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({ apiFetch: vi.fn() }));
vi.mock("./weather", () => ({ batchWeather: vi.fn() }));
vi.mock("./ops", () => ({ getFlight: vi.fn() }));

import { apiFetch } from "./client";
import { packetWeatherFor, riskStops, type AirportInfo } from "./dispatch-risk";
import { getFlight } from "./ops";
import type { FlightDetail, WeatherBatchResponse, WeatherReportResponse } from "./types";
import { batchWeather } from "./weather";

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

describe("packetWeatherFor (#52)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(apiFetch).mockReset();
    vi.mocked(getFlight).mockReset();
    vi.mocked(batchWeather).mockReset();
  });

  const FORECAST = {
    product: "FAAK58",
    region: "Southwest AK & Eastern Aleutians",
    text: "FAAK58 PAWU 061209\nFA8W",
    issued_at: "2026-10-06T12:09:00Z",
    source_url: "https://tgftp.nws.noaa.gov/data/raw/fa/faak58.pawu.fa8.w.txt",
    fetched_at: "2026-10-06T16:00:00Z",
    cache_hit: true,
  };

  it("gathers each stop's reports and the chosen region's forecast", async () => {
    vi.mocked(getFlight).mockResolvedValue({
      origin: "PABE",
      destination: "PAEM",
      stops: ["PABE", "PAEM", "PABE"],
    } as FlightDetail);
    vi.mocked(batchWeather).mockResolvedValue({
      items: [report("PABE", "metar", "PABE 131600Z 34009KT 10SM CLR")],
      errors: [],
    });
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      if (path.startsWith("/weather/airports")) return { airports: [PABE] };
      if (path === "/ops/dispatch/f-1/risk-inputs") return { area_forecast_product: "FAAK58" };
      if (path === "/weather/area-forecasts/FAAK58") return FORECAST;
      throw new Error(`unexpected ${path}`);
    });

    const weather = await packetWeatherFor("f-1");

    expect(weather?.stops.map((s) => [s.ident, s.metar])).toEqual([
      ["PABE", "PABE 131600Z 34009KT 10SM CLR"],
      ["PAEM", null],
    ]);
    // Only what the packet prints.
    expect(weather?.area_forecast).toEqual({
      product: "FAAK58",
      region: "Southwest AK & Eastern Aleutians",
      text: "FAAK58 PAWU 061209\nFA8W",
      issued_at: "2026-10-06T12:09:00Z",
      source_url: "https://tgftp.nws.noaa.gov/data/raw/fa/faak58.pawu.fa8.w.txt",
    });
  });

  it("gives up rather than hold the release up", async () => {
    vi.mocked(getFlight).mockRejectedValueOnce(new Error("ops down"));
    expect(await packetWeatherFor("f-1")).toBeNull();

    vi.useFakeTimers();
    vi.mocked(getFlight).mockReturnValue(new Promise(() => {}));
    const pending = packetWeatherFor("f-1");
    await vi.advanceTimersByTimeAsync(15000);
    expect(await pending).toBeNull();
  });
});
