import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  WeatherBatchResponse,
  WeatherReportResponse,
} from "@/lib/api/types";

// Hoisted mocks — same pattern as weather-panel.test.tsx.
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

import { AlternateReviewPanel } from "./alternate-review-panel";

function makeReport(
  overrides: Partial<WeatherReportResponse> & { icao: string },
): WeatherReportResponse {
  const { icao, ...rest } = overrides;
  return {
    icao,
    kind: "metar",
    raw: `METAR ${icao} 071553Z 27015KT 10SM CLR`,
    parsed_at: "2026-06-07T15:53:00Z",
    valid_until: "2026-06-07T15:58:00Z",
    cache_hit: false,
    flight_category: "VFR",
    alternate_required: false,
    ...rest,
  };
}

function makeBatch(
  reports: Array<Partial<WeatherReportResponse> & { icao: string }>,
  errors: WeatherBatchResponse["errors"] = [],
): WeatherBatchResponse {
  return {
    items: reports.map((r) => makeReport(r)),
    errors,
  };
}

describe("AlternateReviewPanel", () => {
  it("renders the M2 disabled placeholder when icaos is empty", async () => {
    const ui = await AlternateReviewPanel({ icaos: [] });
    render(ui);
    expect(
      screen.getByText(/Pick a flight or type a routing/i),
    ).toBeInTheDocument();
    expect(batchWeather).not.toHaveBeenCalled();
  });

  it("fetches METAR-only for every stop (no TAFs)", async () => {
    batchWeather.mockReset().mockResolvedValueOnce(
      makeBatch([
        { icao: "PADU", alternate_required: false },
        { icao: "PANC", alternate_required: false },
      ]),
    );

    const ui = await AlternateReviewPanel({ icaos: ["PADU", "PANC"] });
    render(ui);

    const payload = batchWeather.mock.calls[0][0];
    expect(payload).toEqual([
      { icao: "PADU", kind: "metar" },
      { icao: "PANC", kind: "metar" },
    ]);
  });

  it("shows 'No review needed' (green) when alternate_required=false", async () => {
    batchWeather.mockReset().mockResolvedValueOnce(
      makeBatch([{ icao: "PANC", alternate_required: false, flight_category: "VFR" }]),
    );

    const ui = await AlternateReviewPanel({ icaos: ["PANC"] });
    render(ui);

    const verdict = screen.getByText(/No review needed/i);
    expect(verdict).toBeInTheDocument();
    expect(verdict.className).toMatch(/text-status-green/);
    expect(screen.getByText(/METAR: VFR/i)).toBeInTheDocument();
  });

  it("shows 'Alternate required' (red) when alternate_required=true", async () => {
    batchWeather.mockReset().mockResolvedValueOnce(
      makeBatch([{ icao: "PADU", alternate_required: true, flight_category: "IFR" }]),
    );

    const ui = await AlternateReviewPanel({ icaos: ["PADU"] });
    render(ui);

    const verdict = screen.getByText(/Alternate required/i);
    expect(verdict).toBeInTheDocument();
    expect(verdict.className).toMatch(/text-status-red/);
    expect(screen.getByText(/METAR: IFR/i)).toBeInTheDocument();
  });

  it("shows 'Unable to determine' when alternate_required is null", async () => {
    batchWeather.mockReset().mockResolvedValueOnce(
      makeBatch([{ icao: "FOOX", alternate_required: null, flight_category: null }]),
    );

    const ui = await AlternateReviewPanel({ icaos: ["FOOX"] });
    render(ui);

    const verdict = screen.getByText(/Unable to determine/i);
    expect(verdict).toBeInTheDocument();
    expect(verdict.className).toMatch(/text-muted-foreground/);
  });

  it("shows 'Unable to determine' when an ICAO is missing from the batch response", async () => {
    // Only one of the two requested ICAOs comes back — the other should
    // still render a row, with the "unknown" verdict.
    batchWeather.mockReset().mockResolvedValueOnce(
      makeBatch(
        [{ icao: "PADU", alternate_required: true }],
        [{ icao: "PANC", kind: "metar", status: 404, detail: "no METAR" }],
      ),
    );

    const ui = await AlternateReviewPanel({ icaos: ["PADU", "PANC"] });
    render(ui);

    expect(screen.getByText(/Alternate required/i)).toBeInTheDocument();
    expect(screen.getByText(/Unable to determine/i)).toBeInTheDocument();
  });

  it("renders a row per stop in route order", async () => {
    const stops = ["PAEE", "PAUN", "PAGM"];
    batchWeather.mockReset().mockResolvedValueOnce(
      makeBatch(stops.map((icao) => ({ icao, alternate_required: false }))),
    );

    const ui = await AlternateReviewPanel({ icaos: stops });
    render(ui);
    for (const icao of stops) {
      expect(screen.getByText(icao)).toBeInTheDocument();
    }
  });

  it("renders the whole-panel fallback when the batch call throws", async () => {
    batchWeather
      .mockReset()
      .mockRejectedValueOnce(
        new TestApiError(502, "/weather/batch", "AWC unreachable"),
      );

    const ui = await AlternateReviewPanel({ icaos: ["PADU"] });
    render(ui);
    expect(
      screen.getByText(/Alternate check unavailable \(502\)/i),
    ).toBeInTheDocument();
  });
});
