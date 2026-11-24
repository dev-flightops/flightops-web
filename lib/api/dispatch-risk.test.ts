import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({ apiFetch: vi.fn() }));
vi.mock("./weather", () => ({ batchWeather: vi.fn() }));
vi.mock("./ops", () => ({ getFlight: vi.fn() }));

import { apiFetch } from "./client";
import {
  loadDispatchRisk,
  packetWeatherFor,
  riskStops,
  weatherCamIn,
  weatherCamsFor,
  type AirportInfo,
} from "./dispatch-risk";
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

describe("loadDispatchRisk with an IFR alternate (1119-18)", () => {
  it("sends the alternate's weather even when the route fills the cap, without its airport record", async () => {
    // Codex on #504: a ten-airport route lost the alternate to the cap.
    const route = ["PABE", "PAKN", "PADM", "PAVA", "PAHP", "PACM", "PASM", "PAEM", "PANI", "PAKI"];
    vi.mocked(batchWeather).mockResolvedValue({ items: [], errors: [] });
    vi.mocked(apiFetch).mockImplementation(async (path: string) =>
      path.startsWith("/weather/airports") ? { airports: [] } : { rows: [], stops: [] },
    );
    await loadDispatchRisk("f-1", route, "padq");
    const weatherFor = vi.mocked(batchWeather).mock.calls[0][0].map((r: { icao: string }) => r.icao);
    expect(new Set(weatherFor)).toEqual(new Set([...route, "PADQ"]));
    const airportsPath = vi.mocked(apiFetch).mock.calls.find(([path]) => String(path).startsWith("/weather/airports"))?.[0];
    expect(decodeURIComponent(String(airportsPath))).toBe(`/weather/airports?ids=${route.join(",")}`);
    const scored = vi.mocked(apiFetch).mock.calls.find(([path]) => String(path) === "/ops/dispatch/f-1/risk");
    const body = JSON.parse(String((scored?.[1] as { body: string }).body));
    expect(body.stops.map((stop: { ident: string }) => stop.ident)).toEqual([...route, "PADQ"]);
  });
});

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
        weathercam: null,
      },
      {
        ident: "A61",
        metar: null,
        taf: null,
        pireps: "BET UA /OV A61/IC MOD RIME",
        airport: { found: false, latitude: null, longitude: null, runways: [] },
        weathercam: null,
      },
    ]);
  });

  it("sends nothing it doesn't have when the weather service is down", () => {
    expect(riskStops(["PABE"], null, null)).toEqual([
      { ident: "PABE", metar: null, taf: null, pireps: null, weathercam: null },
    ]);
  });
});

describe("FAA WeatherCams (#117)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(batchWeather).mockReset();
  });

  const VWOS = {
    ...report("PAEE", "wxcam", "VWOS EEK 260410Z 2 1/2SM -RA OVC008 06/05 A2983"),
    ceiling_ft: 800,
    visibility_sm: 2.5,
    wind_direction_deg: null,
    wind_speed_kt: null,
    wind_gust_kt: null,
    observed_at: "2026-10-26T04:10:26Z",
    site_name: "Eek VWOS",
    site_url: "https://weathercams.faa.gov/map/-180,51,-129,72/cameraSite/102/details/weather",
    estimate: false,
    reports_sky: true,
  } as WeatherReportResponse;

  it("hands ops each stop's reading as it takes it", () => {
    const estimate = {
      ...VWOS,
      icao: "PAHP",
      raw: "Estimated visibility 1.75 SM",
      ceiling_ft: null,
      visibility_sm: 1.75,
      site_name: "Hooper Bay",
      estimate: true,
      reports_sky: false,
    } as WeatherReportResponse;
    const stops = riskStops(["PAEE", "PAHP", "PABE"], null, null, {
      items: [VWOS, estimate],
      errors: [{ icao: "PABE", kind: "wxcam", status: 404, detail: "No FAA WeatherCam site" }],
    });
    expect(stops.map((s) => s.weathercam)).toEqual([
      {
        site_name: "Eek VWOS",
        kind: "vwos",
        observed_at: "2026-10-26T04:10:26Z",
        raw: "VWOS EEK 260410Z 2 1/2SM -RA OVC008 06/05 A2983",
        reports_sky: true,
        ceiling_ft: 800,
        visibility_sm: 2.5,
        wind_direction_deg: null,
        wind_speed_kt: null,
        wind_gust_kt: null,
        page_url: VWOS.site_url,
      },
      // The estimate's text is ours, not the FAA's: it isn't sent as raw.
      expect.objectContaining({ kind: "estimate", raw: null, visibility_sm: 1.75 }),
      null,
    ]);
    expect(weatherCamIn(undefined)).toBeNull();
  });

  it("hands ops a camera site with nothing current, for its page alone (the client, 18 Nov)", () => {
    const dark = {
      ...report("PAHP", "wxcam", "No current reading"),
      observed_at: null,
      site_name: "Hooper Bay",
      site_url: "https://weathercams.faa.gov/map/-180,51,-129,72/cameraSite/151/details/weather",
    } as WeatherReportResponse;
    expect(weatherCamIn(dark)).toEqual({
      site_name: "Hooper Bay",
      kind: "none",
      observed_at: null,
      raw: null,
      reports_sky: false,
      ceiling_ft: null,
      visibility_sm: null,
      wind_direction_deg: null,
      wind_speed_kt: null,
      wind_gust_kt: null,
      page_url: dark.site_url,
    });
    expect(weatherCamIn({ ...dark, site_url: null } as WeatherReportResponse)).toBeNull();
  });

  it("asks in a batch of their own and doesn't wait on a slow FAA page", async () => {
    vi.mocked(batchWeather).mockResolvedValueOnce({ items: [VWOS], errors: [] });
    expect((await weatherCamsFor(["PAEE", "PABE"]))?.items).toEqual([VWOS]);
    expect(batchWeather).toHaveBeenCalledWith([
      { icao: "PAEE", kind: "wxcam" },
      { icao: "PABE", kind: "wxcam" },
    ]);

    vi.useFakeTimers();
    vi.mocked(batchWeather).mockReturnValueOnce(new Promise(() => {}));
    const pending = weatherCamsFor(["PAEE"]);
    await vi.advanceTimersByTimeAsync(12000);
    expect(await pending).toBeNull();
    expect(await weatherCamsFor([])).toBeNull();
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

  it("brings an IFR flight's alternate, as the page scores it (1119-18)", async () => {
    // Left out, the release scored the alternate it couldn't see as HIGH and
    // refused PGR800 while the page showed MEDIUM (24 Nov).
    vi.mocked(getFlight).mockResolvedValue({
      origin: "PABE",
      destination: "PABE",
      stops: ["PABE", "PAHP", "PAVA", "PABE"],
      is_ifr: true,
      alternate_ident: "paem",
    } as FlightDetail);
    vi.mocked(batchWeather).mockResolvedValue({
      items: [report("PAEM", "metar", "PAEM 241812Z AUTO 3SM -SN BR FEW007 BKN012 OVC020")],
      errors: [],
    });
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      if (path.startsWith("/weather/airports")) return { airports: [PABE] };
      if (path === "/ops/dispatch/f-1/risk-inputs") return { area_forecast_product: null };
      throw new Error(`unexpected ${path}`);
    });

    const weather = await packetWeatherFor("f-1");

    expect(weather?.stops.map((s) => s.ident)).toEqual(["PABE", "PAHP", "PAVA", "PAEM"]);
    expect(weather?.stops.at(-1)?.metar).toBe("PAEM 241812Z AUTO 3SM -SN BR FEW007 BKN012 OVC020");
    const asked = vi.mocked(batchWeather).mock.calls[0][0].map((r) => r.icao);
    expect(new Set(asked)).toEqual(new Set(["PABE", "PAHP", "PAVA", "PAEM"]));
  });

  it("leaves a VFR flight's alternate out", async () => {
    vi.mocked(getFlight).mockResolvedValue({
      origin: "PABE",
      destination: "PABE",
      stops: ["PABE", "PAHP", "PABE"],
      is_ifr: false,
      alternate_ident: "PAEM",
    } as FlightDetail);
    vi.mocked(batchWeather).mockResolvedValue({ items: [], errors: [] });
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      if (path.startsWith("/weather/airports")) return { airports: [PABE] };
      if (path === "/ops/dispatch/f-1/risk-inputs") return { area_forecast_product: null };
      throw new Error(`unexpected ${path}`);
    });

    const weather = await packetWeatherFor("f-1");

    expect(weather?.stops.map((s) => s.ident)).toEqual(["PABE", "PAHP"]);
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
