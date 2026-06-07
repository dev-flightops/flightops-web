import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FlightDetail, WeatherReportResponse } from "@/lib/api/types";

// Anything referenced by a `vi.mock` factory has to be hoisted, because
// `vi.mock` calls run *before* the file's top-level statements. So both
// the API stubs and the ApiError stand-in go into a `vi.hoisted` block.
//
// We also stub `@/lib/api/client` to short-circuit the
// next-auth → next/server import chain — vitest can't resolve
// `next/server` without `.js`, and the component only needs `ApiError`
// as a class shape.
const { TestApiError, getMetar, getTaf } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, getMetar: vi.fn(), getTaf: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/weather", () => ({ getMetar, getTaf }));

import { WeatherPanel } from "./weather-panel";

const baseFlight: FlightDetail = {
  id: "f-1",
  flight_number: "GV101",
  origin: "PADU",
  destination: "PANC",
  scheduled_departure_at: "2026-06-07T14:00:00Z",
  scheduled_arrival_at: "2026-06-07T16:00:00Z",
  status: "scheduled",
  aircraft: { id: "ac-1", tail_number: "N207GE", model: "Cessna 208 Caravan", seats: 9 },
  pax_count: 4,
  cargo_lbs: 200,
  notes: null,
  max_payload_lbs: 3000,
  released_at: null,
  released_by: null,
};

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
    ...overrides,
  };
}

describe("WeatherPanel", () => {
  it("renders the M2 disabled placeholder when no flight is selected", async () => {
    const ui = await WeatherPanel({ flight: null });
    render(ui);
    expect(screen.getByText(/Pick a flight from the dropdown above/i)).toBeInTheDocument();
    expect(getMetar).not.toHaveBeenCalled();
    expect(getTaf).not.toHaveBeenCalled();
  });

  it("fetches METAR + TAF for both origin and destination in parallel", async () => {
    getMetar.mockReset();
    getTaf.mockReset();
    getMetar
      .mockResolvedValueOnce(makeReport({ icao: "PADU", raw: "METAR PADU ..." }))
      .mockResolvedValueOnce(makeReport({ icao: "PANC", raw: "METAR PANC ..." }));
    getTaf
      .mockResolvedValueOnce(makeReport({ icao: "PADU", kind: "taf", raw: "TAF PADU ..." }))
      .mockResolvedValueOnce(makeReport({ icao: "PANC", kind: "taf", raw: "TAF PANC ..." }));

    const ui = await WeatherPanel({ flight: baseFlight });
    render(ui);

    expect(getMetar).toHaveBeenCalledWith("PADU");
    expect(getMetar).toHaveBeenCalledWith("PANC");
    expect(getTaf).toHaveBeenCalledWith("PADU");
    expect(getTaf).toHaveBeenCalledWith("PANC");

    expect(screen.getByText("PADU")).toBeInTheDocument();
    expect(screen.getByText("PANC")).toBeInTheDocument();
    expect(screen.getByText("METAR PADU ...")).toBeInTheDocument();
    expect(screen.getByText("TAF PANC ...")).toBeInTheDocument();
  });

  it("deduplicates when origin == destination (training / circling flights)", async () => {
    getMetar.mockReset().mockResolvedValue(makeReport());
    getTaf.mockReset().mockResolvedValue(makeReport({ kind: "taf" }));

    const sameOrigDest: FlightDetail = {
      ...baseFlight,
      origin: "PADU",
      destination: "PADU",
    };
    const ui = await WeatherPanel({ flight: sameOrigDest });
    render(ui);

    expect(getMetar).toHaveBeenCalledTimes(1);
    expect(getTaf).toHaveBeenCalledTimes(1);
  });

  it("shows a 'live' badge when the METAR was just fetched (cache_hit=false)", async () => {
    getMetar.mockReset().mockResolvedValue(makeReport({ cache_hit: false }));
    getTaf.mockReset().mockResolvedValue(makeReport({ kind: "taf" }));

    const ui = await WeatherPanel({ flight: { ...baseFlight, destination: "PADU" } });
    render(ui);

    expect(screen.getByText("live")).toBeInTheDocument();
    expect(screen.queryByText("cached")).not.toBeInTheDocument();
  });

  it("shows a 'cached' badge when the METAR came from the cache (cache_hit=true)", async () => {
    getMetar.mockReset().mockResolvedValue(makeReport({ cache_hit: true }));
    getTaf.mockReset().mockResolvedValue(makeReport({ kind: "taf" }));

    const ui = await WeatherPanel({ flight: { ...baseFlight, destination: "PADU" } });
    render(ui);

    expect(screen.getByText("cached")).toBeInTheDocument();
  });

  it("falls back gracefully when AWC has no TAF for an airport (404)", async () => {
    getMetar.mockReset().mockResolvedValue(makeReport());
    getTaf
      .mockReset()
      .mockRejectedValue(new TestApiError(404, "/weather/taf/PADU", "No current TAF"));

    const ui = await WeatherPanel({ flight: { ...baseFlight, destination: "PADU" } });
    render(ui);

    expect(screen.getByText(/No current TAF for this airport/i)).toBeInTheDocument();
  });

  it("falls back gracefully when the upstream weather feed is unreachable (502)", async () => {
    getMetar
      .mockReset()
      .mockRejectedValue(new TestApiError(502, "/weather/metar/PADU", "AWC unreachable"));
    getTaf
      .mockReset()
      .mockRejectedValue(new TestApiError(502, "/weather/taf/PADU", "AWC unreachable"));

    const ui = await WeatherPanel({ flight: { ...baseFlight, destination: "PADU" } });
    render(ui);

    expect(
      screen.getAllByText(/feed unreachable — try Refresh Weather/i).length,
    ).toBeGreaterThan(0);
  });
});
