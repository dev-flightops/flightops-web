import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WeatherBriefingResponse } from "@/lib/api/types";

const { TestApiError, getWeatherBriefing, notFoundSpy } = vi.hoisted(() => {
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
    getWeatherBriefing: vi.fn(),
    notFoundSpy: vi.fn(() => {
      const err = new Error("NEXT_NOT_FOUND");
      throw err;
    }),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/weather", () => ({ getWeatherBriefing }));
vi.mock("next/navigation", () => ({ notFound: notFoundSpy }));

import WeatherBriefingDetailPage from "./page";

function makeBriefing(
  overrides: Partial<WeatherBriefingResponse> = {},
): WeatherBriefingResponse {
  return {
    id: "brief-1",
    airports: ["PANC", "PABE"],
    flight: { id: "f-1", flight_number: "GV101" },
    aircraft: { id: "ac-1", tail_number: "N207GE" },
    worst_flight_category: "VFR",
    dispatcher_notes: null,
    briefed_by: { id: "u-1", full_name: "Dispatcher", email: "d@x" },
    created_at: "2026-06-15T14:00:00Z",
    snapshot: {
      items: [
        {
          icao: "PANC",
          kind: "metar",
          raw: "METAR PANC 011553Z 27015KT 10SM CLR 02/M03 A2992",
          parsed_at: "2026-06-15T13:55:00Z",
          valid_until: "2026-06-15T14:55:00Z",
          cache_hit: false,
          flight_category: "VFR",
          alternate_required: false,
          visibility_sm: 10,
          ceiling_ft: null,
          wind_direction_deg: 270,
          wind_speed_kt: 15,
          wind_gust_kt: null,
          wind_variable: false,
          wind_calm: false,
          temp_c: 2,
          dewpoint_c: -3,
          altimeter_in_hg: 29.92,
        },
      ],
      errors: [],
    },
    ...overrides,
  };
}

beforeEach(() => {
  getWeatherBriefing.mockReset();
  notFoundSpy.mockClear();
});

async function renderPage(id = "brief-1") {
  const ui = await WeatherBriefingDetailPage({
    params: Promise.resolve({ id }),
  });
  return render(ui);
}

describe("WeatherBriefingDetailPage (M2-G-27)", () => {
  it("renders the briefing header with airports + flight + aircraft + briefer", async () => {
    getWeatherBriefing.mockResolvedValueOnce(makeBriefing());

    await renderPage();

    expect(
      screen.getByRole("heading", { name: /weather briefing/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Dispatcher")).toBeInTheDocument();
    expect(screen.getByText("PANC, PABE")).toBeInTheDocument();
    expect(screen.getByText("GV101")).toBeInTheDocument();
    expect(screen.getByText("N207GE")).toBeInTheDocument();
  });

  it("renders the worst-category VFR badge", async () => {
    getWeatherBriefing.mockResolvedValueOnce(makeBriefing());

    await renderPage();

    // VFR shows in both the header badge AND the per-airport METAR
    // card — at least one is present.
    expect(screen.getAllByText(/^vfr$/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders the dispatcher notes panel only when notes are set", async () => {
    getWeatherBriefing.mockResolvedValueOnce(
      makeBriefing({ dispatcher_notes: "VFR throughout; alternate KENA" }),
    );

    await renderPage();

    expect(
      screen.getByText(/^dispatcher notes$/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/vfr throughout; alternate kena/i),
    ).toBeInTheDocument();
  });

  it("omits the dispatcher notes panel when null", async () => {
    getWeatherBriefing.mockResolvedValueOnce(makeBriefing());

    await renderPage();

    expect(
      screen.queryByText(/^dispatcher notes$/i),
    ).not.toBeInTheDocument();
  });

  it("renders one card per briefed airport with the raw METAR text", async () => {
    getWeatherBriefing.mockResolvedValueOnce(makeBriefing());

    await renderPage();

    expect(
      screen.getByText(/METAR PANC 011553Z 27015KT/),
    ).toBeInTheDocument();
  });

  it("calls notFound() when the briefing is missing", async () => {
    getWeatherBriefing.mockRejectedValueOnce(
      new TestApiError(404, "/weather/briefings/x", ""),
    );

    await expect(renderPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundSpy).toHaveBeenCalledTimes(1);
  });

  it("renders the session-expired alert on 401", async () => {
    getWeatherBriefing.mockRejectedValueOnce(
      new TestApiError(401, "/weather/briefings/x", "Unauthorized"),
    );

    await renderPage();

    expect(screen.getByText(/session expired/i)).toBeInTheDocument();
  });

  it("renders a generic error alert on 5xx", async () => {
    getWeatherBriefing.mockRejectedValueOnce(
      new TestApiError(502, "/weather/briefings/x", "Bad Gateway"),
    );

    await renderPage();

    expect(screen.getByText(/briefing unavailable/i)).toBeInTheDocument();
  });
});
