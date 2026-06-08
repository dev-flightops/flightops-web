import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  WeatherBatchResponse,
  WeatherReportResponse,
} from "@/lib/api/types";

// Same hoisting + ApiError stub as before — vi.mock factories run before
// top-level code, and we still need to short-circuit the @/lib/api/client
// → next-auth → next/server import chain.
const { TestApiError, batchWeather } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, batchWeather: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/weather", () => ({ batchWeather }));

import { WeatherPanel } from "./weather-panel";

function makeReport(
  overrides: Partial<WeatherReportResponse> = {},
): WeatherReportResponse {
  return {
    icao: "PADU",
    kind: "metar",
    raw: "METAR PADU 071553Z 27015KT 10SM CLR 05/03 A2980",
    parsed_at: "2026-06-07T15:53:00Z",
    valid_until: "2026-06-07T15:58:00Z",
    cache_hit: false,
    flight_category: "VFR",
    alternate_required: false,
    visibility_sm: 10.0,
    ceiling_ft: null,
    wind_direction_deg: 270,
    wind_speed_kt: 15,
    wind_gust_kt: null,
    wind_variable: false,
    wind_calm: false,
    temp_c: 5,
    dewpoint_c: 3,
    altimeter_in_hg: 29.8,
    ...overrides,
  };
}

/** Build a WeatherBatchResponse from per-(icao,kind) report overrides.
 *  Anything not in `reports` and not in `errors` is omitted from the
 *  response — the component handles the "neither item nor error" case
 *  defensively. */
function makeBatch(
  reports: Array<Partial<WeatherReportResponse> & { icao: string; kind: "metar" | "taf" }>,
  errors: WeatherBatchResponse["errors"] = [],
): WeatherBatchResponse {
  return {
    items: reports.map((r) => makeReport({ ...r, raw: r.raw ?? `${r.kind.toUpperCase()} ${r.icao} ...` })),
    errors,
  };
}

describe("WeatherPanel", () => {
  it("renders the M2 disabled placeholder when the icaos list is empty", async () => {
    const ui = await WeatherPanel({ icaos: [] });
    render(ui);
    expect(
      screen.getByText(/Pick a flight from the dropdown above, or type a routing/i),
    ).toBeInTheDocument();
    expect(batchWeather).not.toHaveBeenCalled();
  });

  it("fetches METAR + TAF for every ICAO in one batch round-trip", async () => {
    batchWeather.mockReset().mockResolvedValueOnce(
      makeBatch([
        { icao: "PADU", kind: "metar" },
        { icao: "PADU", kind: "taf", raw: "TAF PADU ..." },
        { icao: "PANC", kind: "metar" },
        { icao: "PANC", kind: "taf", raw: "TAF PANC ..." },
      ]),
    );

    const ui = await WeatherPanel({ icaos: ["PADU", "PANC"] });
    render(ui);

    expect(batchWeather).toHaveBeenCalledTimes(1);
    const payload = batchWeather.mock.calls[0][0];
    expect(payload).toEqual([
      { icao: "PADU", kind: "metar" },
      { icao: "PADU", kind: "taf" },
      { icao: "PANC", kind: "metar" },
      { icao: "PANC", kind: "taf" },
    ]);

    expect(screen.getByText("PADU")).toBeInTheDocument();
    expect(screen.getByText("PANC")).toBeInTheDocument();
    expect(screen.getByText(/TAF PANC/)).toBeInTheDocument();
  });

  it("deduplicates repeated ICAOs in the routing", async () => {
    batchWeather.mockReset().mockResolvedValueOnce(
      makeBatch([
        { icao: "PADU", kind: "metar" },
        { icao: "PADU", kind: "taf" },
      ]),
    );

    const ui = await WeatherPanel({ icaos: ["PADU", "PADU", "PADU"] });
    render(ui);

    expect(batchWeather).toHaveBeenCalledTimes(1);
    const payload = batchWeather.mock.calls[0][0];
    // Only one (PADU, metar) + one (PADU, taf) — duplicates dropped before
    // the request even fires.
    expect(payload).toEqual([
      { icao: "PADU", kind: "metar" },
      { icao: "PADU", kind: "taf" },
    ]);
  });

  it("renders a 'cached' badge when the METAR came from the cache", async () => {
    batchWeather.mockReset().mockResolvedValueOnce(
      makeBatch([
        { icao: "PADU", kind: "metar", cache_hit: true },
        { icao: "PADU", kind: "taf", cache_hit: true },
      ]),
    );

    const ui = await WeatherPanel({ icaos: ["PADU"] });
    render(ui);

    expect(screen.getByText("cached")).toBeInTheDocument();
    expect(screen.queryByText("live")).not.toBeInTheDocument();
  });

  it("renders the per-row 404 fallback when batch.errors has a TAF entry", async () => {
    batchWeather.mockReset().mockResolvedValueOnce(
      makeBatch(
        [{ icao: "PADU", kind: "metar" }],
        [{ icao: "PADU", kind: "taf", status: 404, detail: "No current TAF" }],
      ),
    );

    const ui = await WeatherPanel({ icaos: ["PADU"] });
    render(ui);

    expect(screen.getByText(/No current TAF for this airport/i)).toBeInTheDocument();
  });

  it("renders the whole-panel fallback when the batch call itself throws (502)", async () => {
    batchWeather
      .mockReset()
      .mockRejectedValueOnce(
        new TestApiError(502, "/weather/batch", "AWC unreachable"),
      );

    const ui = await WeatherPanel({ icaos: ["PADU", "PANC"] });
    render(ui);

    expect(
      screen.getByText(/Weather feed unavailable \(502\)/i),
    ).toBeInTheDocument();
  });

  // M2-G-11 carry-overs: the colored category pill still works through
  // the batch path.
  it("renders the FAA flight category pill from the METAR's flight_category", async () => {
    batchWeather.mockReset().mockResolvedValueOnce(
      makeBatch([
        { icao: "PADU", kind: "metar", flight_category: "VFR" },
        { icao: "PANC", kind: "metar", flight_category: "IFR" },
      ]),
    );

    const ui = await WeatherPanel({ icaos: ["PADU", "PANC"] });
    render(ui);

    const vfrBadge = screen.getByText("VFR");
    expect(vfrBadge.className).toMatch(/text-status-green/);
    const ifrBadge = screen.getByText("IFR");
    expect(ifrBadge.className).toMatch(/text-status-red/);
  });

  it("hides the category pill when the METAR has no flight_category", async () => {
    batchWeather.mockReset().mockResolvedValueOnce(
      makeBatch([
        { icao: "PADU", kind: "metar", flight_category: null },
      ]),
    );

    const ui = await WeatherPanel({ icaos: ["PADU"] });
    render(ui);
    for (const cat of ["VFR", "MVFR", "IFR", "LIFR"] as const) {
      expect(screen.queryByText(cat)).not.toBeInTheDocument();
    }
  });

  it("hides the category pill when the METAR returned an error (no report to read)", async () => {
    batchWeather.mockReset().mockResolvedValueOnce(
      makeBatch(
        [],
        [{ icao: "PADU", kind: "metar", status: 502, detail: "down" }],
      ),
    );

    const ui = await WeatherPanel({ icaos: ["PADU"] });
    render(ui);
    for (const cat of ["VFR", "MVFR", "IFR", "LIFR"] as const) {
      expect(screen.queryByText(cat)).not.toBeInTheDocument();
    }
  });

  // M2-G-12: multi-stop coverage
  it("renders a card per stop in route order", async () => {
    const stops = ["PAEE", "PAUN", "PAGM"];
    batchWeather.mockReset().mockResolvedValueOnce(
      makeBatch(
        stops.flatMap((icao) => [
          { icao, kind: "metar" as const },
          { icao, kind: "taf" as const },
        ]),
      ),
    );

    const ui = await WeatherPanel({ icaos: stops });
    render(ui);

    for (const icao of stops) {
      expect(screen.getByText(icao)).toBeInTheDocument();
    }
  });

  it("shows the truncation warning when the route is longer than 10 stops", async () => {
    // Build a 12-stop route (synthetic ICAOs). The panel should slice to
    // the first 10 and surface a "first 10 of 12" hint.
    const longRoute = Array.from({ length: 12 }, (_, i) => `K${String(i).padStart(3, "0")}`);
    batchWeather.mockReset().mockResolvedValueOnce(
      makeBatch(
        longRoute.slice(0, 10).flatMap((icao) => [
          { icao, kind: "metar" as const },
          { icao, kind: "taf" as const },
        ]),
      ),
    );

    const ui = await WeatherPanel({ icaos: longRoute });
    render(ui);

    expect(
      screen.getByText(/Showing first 10 stops of 12/i),
    ).toBeInTheDocument();
    // Backend was asked for only 20 records (10 stops × 2 kinds), not 24.
    expect(batchWeather.mock.calls[0][0]).toHaveLength(20);
  });

  // ---- M2-G-14 rich card ----------------------------------------------------

  it("tags multi-stop routes with DEPARTURE / EN ROUTE / DESTINATION", async () => {
    batchWeather.mockReset().mockResolvedValueOnce(
      makeBatch(
        ["PAEE", "PAUN", "PAGM"].flatMap((icao) => [
          { icao, kind: "metar" as const },
          { icao, kind: "taf" as const },
        ]),
      ),
    );

    const ui = await WeatherPanel({ icaos: ["PAEE", "PAUN", "PAGM"] });
    render(ui);

    expect(screen.getByText("DEPARTURE")).toBeInTheDocument();
    expect(screen.getByText("EN ROUTE")).toBeInTheDocument();
    expect(screen.getByText("DESTINATION")).toBeInTheDocument();
  });

  it("omits role tags on a single-stop route", async () => {
    batchWeather.mockReset().mockResolvedValueOnce(
      makeBatch([
        { icao: "PADU", kind: "metar" },
        { icao: "PADU", kind: "taf" },
      ]),
    );

    const ui = await WeatherPanel({ icaos: ["PADU"] });
    render(ui);

    expect(screen.queryByText("DEPARTURE")).not.toBeInTheDocument();
    expect(screen.queryByText("DESTINATION")).not.toBeInTheDocument();
  });

  it("renders the panel-header airport count + pulled-at timestamp", async () => {
    // Override parsed_at on every item — pulled-at is the max across the
    // whole response, so the TAF defaults from makeReport would otherwise
    // win and shift the header timestamp.
    batchWeather.mockReset().mockResolvedValueOnce(
      makeBatch([
        { icao: "PADU", kind: "metar", parsed_at: "2026-06-07T01:49:00Z" },
        { icao: "PANC", kind: "metar", parsed_at: "2026-06-07T01:47:00Z" },
        { icao: "PADU", kind: "taf", parsed_at: "2026-06-07T01:46:00Z" },
        { icao: "PANC", kind: "taf", parsed_at: "2026-06-07T01:45:00Z" },
      ]),
    );

    const ui = await WeatherPanel({ icaos: ["PADU", "PANC"] });
    render(ui);

    expect(screen.getByText(/2 airports.*pulled 01:49Z/)).toBeInTheDocument();
  });

  it("renders the parsed-field grid for each METAR (ceiling/vis/wind/temp/altimeter)", async () => {
    batchWeather.mockReset().mockResolvedValueOnce(
      makeBatch([
        {
          icao: "PADM",
          kind: "metar",
          ceiling_ft: 4000,
          visibility_sm: 10,
          wind_direction_deg: 270,
          wind_speed_kt: 8,
          wind_gust_kt: 15,
          temp_c: 14,
          dewpoint_c: 4,
          altimeter_in_hg: 29.66,
        },
        { icao: "PADM", kind: "taf" },
      ]),
    );

    const ui = await WeatherPanel({ icaos: ["PADM"] });
    render(ui);

    expect(screen.getByText("Ceiling")).toBeInTheDocument();
    expect(screen.getByText("4,000 ft")).toBeInTheDocument();
    expect(screen.getByText("Visibility")).toBeInTheDocument();
    expect(screen.getByText("10.0 SM")).toBeInTheDocument();
    expect(screen.getByText("Wind")).toBeInTheDocument();
    expect(screen.getByText("270° @ 8G15 kt")).toBeInTheDocument();
    expect(screen.getByText("Temp / Dew")).toBeInTheDocument();
    expect(screen.getByText("14°C / 4°C")).toBeInTheDocument();
    expect(screen.getByText("Altimeter")).toBeInTheDocument();
    expect(screen.getByText("29.66 inHg")).toBeInTheDocument();
  });

  it("renders the legacy-style one-line summary above the grid", async () => {
    batchWeather.mockReset().mockResolvedValueOnce(
      makeBatch([
        {
          icao: "PADM",
          kind: "metar",
          flight_category: "VFR",
          wind_direction_deg: 270,
          wind_speed_kt: 8,
          wind_gust_kt: null,
          ceiling_ft: 4000,
          visibility_sm: 10,
          temp_c: 14,
          dewpoint_c: 4,
          altimeter_in_hg: 29.66,
        },
        { icao: "PADM", kind: "taf" },
      ]),
    );

    const ui = await WeatherPanel({ icaos: ["PADM"] });
    render(ui);
    // Substring match (full sentence is verified by lib/weather-format.test).
    expect(
      screen.getByText(/Vfr, wind 270° at 8 kts, visibility 10\.0 sm/i),
    ).toBeInTheDocument();
  });

  it("hides parsed-field grid + summary when METAR errored (per-row degradation)", async () => {
    batchWeather.mockReset().mockResolvedValueOnce(
      makeBatch(
        [],
        [{ icao: "PAEE", kind: "metar", status: 404, detail: "No METAR" }],
      ),
    );

    const ui = await WeatherPanel({ icaos: ["PAEE"] });
    render(ui);

    // Card still renders with ICAO + per-row fallback, but no field grid.
    expect(screen.getByText("PAEE")).toBeInTheDocument();
    expect(
      screen.getByText(/No current METAR for this airport/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Ceiling")).not.toBeInTheDocument();
  });
});
