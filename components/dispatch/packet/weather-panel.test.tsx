import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { StopWeather } from "@/lib/api/dispatch-risk";
import type {
  VillageBoardResponse,
  VillageBoardRow,
  WeatherBatchResponse,
  WeatherReportResponse,
} from "@/lib/api/types";

// Same hoisting + ApiError stub as before — vi.mock factories run before
// top-level code, and we still need to short-circuit the @/lib/api/client
// → next-auth → next/server import chain.
const { TestApiError, batchWeather, getVillageBoard, weatherCamsFor } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    TestApiError,
    batchWeather: vi.fn(),
    getVillageBoard: vi.fn(async (): Promise<VillageBoardResponse> => ({ items: [], total: 0 })),
    // The WeatherCams come in a batch of their own (#117); none by default.
    weatherCamsFor: vi.fn(async (): Promise<WeatherBatchResponse | null> => null),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/weather", () => ({ batchWeather, getVillageBoard }));
vi.mock("@/lib/api/dispatch-risk", () => ({ weatherCamsFor }));

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
  reports: Array<Partial<WeatherReportResponse> & { icao: string; kind: "metar" | "taf" | "pirep" }>,
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

  it("fetches METAR, TAF and PIREPs for every ICAO in one batch round-trip", async () => {
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
      { icao: "PADU", kind: "pirep" },
      { icao: "PANC", kind: "metar" },
      { icao: "PANC", kind: "taf" },
      { icao: "PANC", kind: "pirep" },
    ]);

    expect(screen.getByText("PADU")).toBeInTheDocument();
    expect(screen.getByText("PANC")).toBeInTheDocument();
    expect(screen.getByText(/TAF PANC/)).toBeInTheDocument();
  });

  it("says when the latest report is a special one, as PABE's was (#71)", async () => {
    batchWeather.mockReset().mockResolvedValueOnce(
      makeBatch([
        {
          icao: "PABE",
          kind: "metar",
          raw: "SPECI PABE 111659Z 17011KT 10SM BKN005 04/03 A2940 RMK AO2 T00390033 $",
        },
        { icao: "PAVA", kind: "metar", raw: "METAR PAVA 111656Z 18008KT 10SM SCT016 05/03 A2941" },
      ]),
    );
    render(await WeatherPanel({ icaos: ["PABE", "PAVA"] }));
    const chips = screen.getAllByText(/^SPECI \d{2}:\d{2}Z$/);
    expect(chips.map((c) => c.textContent)).toEqual(["SPECI 16:59Z"]);
    expect(chips[0]).toHaveAttribute("title", expect.stringMatching(/^Special report/));
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
    // One of each kind for PADU — duplicates dropped before the request
    // even fires.
    expect(payload).toEqual([
      { icao: "PADU", kind: "metar" },
      { icao: "PADU", kind: "taf" },
      { icao: "PADU", kind: "pirep" },
    ]);
  });

  it("shows each stop's PIREPs, says when there are none, and when the feed is down", async () => {
    batchWeather.mockReset().mockResolvedValueOnce(
      makeBatch(
        [
          { icao: "PABE", kind: "metar" },
          {
            icao: "PABE",
            kind: "pirep",
            raw: "BET UA /OV BET/TM 1520/FL050/TP C208/IC MOD RIME 040-060",
          },
          { icao: "PAEM", kind: "metar" },
          { icao: "PAEM", kind: "pirep", raw: "" },
        ],
        [{ icao: "PAVA", kind: "pirep", status: 502, detail: "AWC down" }],
      ),
    );

    render(await WeatherPanel({ icaos: ["PABE", "PAEM", "PAVA"] }));

    expect(screen.getByText(/IC MOD RIME 040-060/)).toBeInTheDocument();
    expect(screen.getByText("None within 50 nm in the last 3 hours.")).toBeInTheDocument();
    expect(screen.getByText("PIREPs feed unreachable — try Refresh Weather.")).toBeInTheDocument();
  });

  it("does NOT render a per-card cache/live badge (legacy-parity — pulled-at on the panel header surfaces freshness instead)", async () => {
    batchWeather.mockReset().mockResolvedValueOnce(
      makeBatch([
        { icao: "PADU", kind: "metar", cache_hit: true },
        { icao: "PADU", kind: "taf", cache_hit: true },
      ]),
    );

    const ui = await WeatherPanel({ icaos: ["PADU"] });
    render(ui);

    // Removed in the style-match pass — legacy doesn't show these per
    // card; the panel-header "pulled HH:MMZ" is the single source of
    // freshness signal.
    expect(screen.queryByText("cached")).not.toBeInTheDocument();
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
    // Backend was asked for only 30 records (10 stops × 3 kinds), not 36.
    expect(batchWeather.mock.calls[0][0]).toHaveLength(30);
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

describe("WeatherPanel — village reports (#110)", () => {
  const village = (): VillageBoardRow & {
    latest_report: NonNullable<VillageBoardRow["latest_report"]>;
  } => ({
    airport: {
      id: "va-1",
      icao: "PAII",
      name: "Egegik",
      region: "Bristol Bay",
      is_active: true,
      notes: null,
      has_instrument_approach: false,
      instrument_approach_changed_at: null,
    },
    latest_report: {
      id: "r-1",
      village_airport_id: "va-1",
      reported_by: { id: "u-1", full_name: "Owen Staley" },
      reported_by_name: null,
      reported_at: new Date(Date.now() - 65 * 60_000).toISOString(),
      cloud_cover: "OVC",
      ceiling_ft: 500,
      visibility_sm: 3,
      wind_dir_deg: 120,
      wind_speed_kt: 12,
      wind_gust_kt: 28,
      temperature_c: -2,
      altimeter_in_hg: 29.92,
      notes: "Fog over the river",
      flight_category: "IFR",
    },
  });

  it("shows the stop's village report under its METAR, and that it has no approach", async () => {
    getVillageBoard.mockResolvedValueOnce({ items: [village()], total: 1 });
    batchWeather.mockReset().mockResolvedValueOnce(
      makeBatch([
        { icao: "PAKN", kind: "metar" },
        { icao: "PAII", kind: "metar" },
      ]),
    );
    render(await WeatherPanel({ icaos: ["PAKN", "PAII"] }));
    expect(screen.getAllByText("Village Report")).toHaveLength(1);
    expect(
      // What set the category, with it (#149).
      screen.getByText('IFR (ceiling 500 ft) · OVC 500ft · Vis 3SM · Wind 120°/12ktG28 · -2°C · 29.92"'),
    ).toBeInTheDocument();
    expect(screen.getByText("Fog over the river")).toBeInTheDocument();
    expect(screen.getByText(/by Owen Staley · 1\.1h ago$/)).toBeInTheDocument();
    expect(screen.getByText(/No instrument approach/)).toBeInTheDocument();
  });

  it("shows the observer's photos with the report (#121)", async () => {
    const withPhotos = village();
    withPhotos.latest_report = {
      ...withPhotos.latest_report!,
      photos: [{ id: "ph-1", width: 1280, height: 960 }],
    };
    getVillageBoard.mockResolvedValueOnce({ items: [withPhotos], total: 1 });
    batchWeather.mockReset().mockResolvedValueOnce(makeBatch([{ icao: "PAII", kind: "metar" }]));
    render(await WeatherPanel({ icaos: ["PAII"] }));
    expect(screen.getByRole("link", { name: "Photo 1 of 1, full size in a new tab" })).toHaveAttribute(
      "href",
      "/api/village-photos/ph-1",
    );
  });

  it("flags a report older than two hours, and stands without the board", async () => {
    const old = village();
    old.latest_report.reported_at = new Date(Date.now() - 150 * 60_000).toISOString();
    getVillageBoard.mockResolvedValueOnce({ items: [old], total: 1 });
    batchWeather.mockReset().mockResolvedValueOnce(makeBatch([{ icao: "PAII", kind: "metar" }]));
    render(await WeatherPanel({ icaos: ["PAII"] }));
    expect(screen.getByText(/older than 2 hours$/)).toBeInTheDocument();

    getVillageBoard.mockRejectedValueOnce(new Error("down"));
    batchWeather.mockReset().mockResolvedValueOnce(makeBatch([{ icao: "PAII", kind: "metar" }]));
    render(await WeatherPanel({ icaos: ["PAII"] }));
    expect(screen.getAllByText("Village Report")).toHaveLength(1);
  });
});

describe("WeatherPanel — where each stop's weather came from (#117)", () => {
  function stop(overrides: Partial<StopWeather> & { ident: string }): StopWeather {
    return {
      source: "metar",
      certified: true,
      described: "METAR",
      ceiling_ft: null,
      ceiling_from: "METAR",
      visibility_sm: 10,
      visibility_from: "METAR",
      wind_direction: "270",
      wind_kt: 15,
      wind_gust_kt: null,
      wind_from: "METAR",
      ...overrides,
    };
  }

  const CAM = makeReport({
    icao: "PAEE",
    kind: "wxcam",
    raw: "VWOS EEK 260410Z 2 1/2SM -RA OVC008 06/05 A2983",
    flight_category: "IFR",
    ceiling_ft: 800,
    visibility_sm: 2.5,
    observed_at: new Date(Date.now() - 12 * 60_000).toISOString(),
    site_name: "Eek VWOS",
    site_url: "https://weathercams.faa.gov/map/-180,51,-129,72/cameraSite/102/details/weather",
    estimate: false,
    reports_sky: true,
  });

  it("names the source a stop was scored on, and says when it isn't certified", async () => {
    batchWeather.mockReset().mockResolvedValueOnce(
      makeBatch([{ icao: "PABE", kind: "metar" }], [
        { icao: "PAEE", kind: "metar", status: 404, detail: "No METAR" },
      ]),
    );
    weatherCamsFor.mockResolvedValueOnce({ items: [CAM], errors: [] });
    render(
      await WeatherPanel({
        icaos: ["PABE", "PAEE"],
        nonCertified: true,
        stopWeather: [
          stop({ ident: "PABE" }),
          stop({
            ident: "PAEE",
            source: "weathercam",
            certified: false,
            described: "FAA WeatherCam, not certified",
            ceiling_ft: 800,
            ceiling_from: "FAA WeatherCam",
            visibility_sm: 2.5,
            visibility_from: "FAA WeatherCam",
            wind_direction: null,
            wind_kt: null,
            wind_from: null,
          }),
        ],
      }),
    );
    expect(screen.getByText("Official METAR/TAF")).toBeInTheDocument();
    expect(screen.getByText("FAA WeatherCam · Not certified")).toBeInTheDocument();
    expect(screen.getByText("Not certified weather")).toBeInTheDocument();
    expect(screen.getByText(/OpSpecs authorize non-certified weather/)).toBeInTheDocument();
    // No METAR at Eek: what it was scored on, and the reading itself.
    expect(screen.getByText("Scored on")).toBeInTheDocument();
    expect(screen.getByText("Ceiling 800 ft (FAA WeatherCam)")).toBeInTheDocument();
    expect(screen.getByText("Visibility 2.5 SM (FAA WeatherCam)")).toBeInTheDocument();
    expect(screen.getByText("FAA WeatherCam · Eek VWOS · not certified")).toBeInTheDocument();
    expect(screen.getByText("VWOS EEK 260410Z 2 1/2SM -RA OVC008 06/05 A2983")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cameras on FAA WeatherCams" })).toHaveAttribute(
      "href",
      CAM.site_url,
    );
    expect(weatherCamsFor).toHaveBeenCalledWith(["PABE", "PAEE"]);
  });

  it("shows a worse reading beside the METAR, and the cameras' estimate as one", async () => {
    batchWeather.mockReset().mockResolvedValueOnce(makeBatch([{ icao: "PAHP", kind: "metar" }]));
    weatherCamsFor.mockResolvedValueOnce({
      items: [
        makeReport({
          ...CAM,
          icao: "PAHP",
          raw: "Estimated visibility 1.75 SM",
          site_name: "Hooper Bay",
          estimate: true,
          confidence: 52,
          site_url: null,
        }),
      ],
      errors: [],
    });
    render(
      await WeatherPanel({
        icaos: ["PAHP"],
        stopWeather: [
          stop({
            ident: "PAHP",
            certified: false,
            described: "METAR and FAA WeatherCam estimate, not certified",
            visibility_sm: 1.75,
            visibility_from: "FAA WeatherCam estimate",
          }),
        ],
      }),
    );
    expect(screen.getByText("METAR and FAA WeatherCam estimate · Not certified")).toBeInTheDocument();
    expect(screen.getByText("Scored on a worse reading")).toBeInTheDocument();
    expect(screen.getByText("Visibility 1.75 SM (FAA WeatherCam estimate)")).toBeInTheDocument();
    expect(
      screen.getByText("Estimated visibility 1.75 SM (the cameras' estimate, 52% confidence)"),
    ).toBeInTheDocument();
    // The notice comes from the risk's verdict, which this render didn't pass.
    expect(screen.queryByText("Not certified weather")).not.toBeInTheDocument();
  });

  it("names the METAR alone without the risk, as before", async () => {
    batchWeather.mockReset().mockResolvedValueOnce(makeBatch([{ icao: "PADU", kind: "metar" }]));
    render(await WeatherPanel({ icaos: ["PADU"] }));
    expect(screen.getByText("Official METAR/TAF")).toBeInTheDocument();
    expect(screen.queryByText(/Scored on/)).not.toBeInTheDocument();
  });
});

