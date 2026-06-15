import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CompanyBaseResponse,
  WeatherReportResponse,
} from "@/lib/api/types";

const { TestApiError, listCompanyBases, batchWeather } = vi.hoisted(() => {
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
    listCompanyBases: vi.fn(),
    batchWeather: vi.fn(),
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/auth", () => ({ listCompanyBases }));
vi.mock("@/lib/api/weather", () => ({ batchWeather }));

import VillageWxPage from "./page";

function makeBase(overrides: Partial<CompanyBaseResponse>): CompanyBaseResponse {
  return {
    id: "b-1",
    icao: "PANC",
    display_name: "Anchorage",
    city: null,
    state: null,
    timezone: null,
    is_hub: false,
    is_active: true,
    manager_name: null,
    manager_phone: null,
    manager_email: null,
    notes: null,
    ...overrides,
  };
}

function makeReport(
  overrides: Partial<WeatherReportResponse>,
): WeatherReportResponse {
  return {
    icao: "PANC",
    kind: "metar",
    raw: "METAR PANC 151853Z 23012KT 10SM SCT040 02/M03 A2998 RMK AO2",
    parsed_at: "2026-06-15T18:53:00Z",
    valid_until: "2026-06-15T19:53:00Z",
    cache_hit: false,
    flight_category: "VFR",
    alternate_required: false,
    visibility_sm: 10,
    ceiling_ft: null,
    wind_direction_deg: 230,
    wind_speed_kt: 12,
    wind_gust_kt: null,
    wind_variable: false,
    wind_calm: false,
    temp_c: 2,
    dewpoint_c: -3,
    altimeter_in_hg: 29.98,
    ...overrides,
  };
}

beforeEach(() => {
  listCompanyBases.mockReset();
  batchWeather.mockReset();
});

async function renderPage(searchParams: { scope?: string } = {}) {
  const ui = await VillageWxPage({
    searchParams: Promise.resolve(searchParams),
  });
  return render(ui);
}

describe("VillageWxPage (M2)", () => {
  it("filters to non-hub bases by default and renders METAR + TAF rows", async () => {
    listCompanyBases.mockResolvedValueOnce({
      items: [
        makeBase({ id: "b-1", icao: "PANC", is_hub: true }),
        makeBase({
          id: "b-2",
          icao: "PAAQ",
          display_name: "Palmer",
        }),
      ],
      total: 2,
    });
    batchWeather.mockResolvedValueOnce({
      items: [
        makeReport({
          icao: "PAAQ",
          kind: "metar",
          flight_category: "MVFR",
          raw: "METAR PAAQ 151853Z 27006KT 5SM BKN030 OVC050 01/M01 A2996",
        }),
        makeReport({
          icao: "PAAQ",
          kind: "taf",
          raw: "TAF PAAQ 151720Z 1518/1624 23010KT P6SM SCT050",
          flight_category: null,
        }),
      ],
      errors: [],
    });

    await renderPage();

    // PANC (hub) excluded under default scope
    expect(screen.queryByText("PANC")).not.toBeInTheDocument();
    expect(screen.getByText("PAAQ")).toBeInTheDocument();
    expect(screen.getByText("Palmer")).toBeInTheDocument();
    expect(screen.getByText("MVFR")).toBeInTheDocument();
    expect(screen.getByText(/METAR PAAQ/)).toBeInTheDocument();
    expect(screen.getByText(/TAF PAAQ/)).toBeInTheDocument();
  });

  it("includes hub bases when scope=all", async () => {
    listCompanyBases.mockResolvedValueOnce({
      items: [
        makeBase({ id: "b-1", icao: "PANC", is_hub: true }),
        makeBase({ id: "b-2", icao: "PAAQ" }),
      ],
      total: 2,
    });
    batchWeather.mockResolvedValueOnce({ items: [], errors: [] });

    await renderPage({ scope: "all" });

    expect(screen.getByText("PANC")).toBeInTheDocument();
    expect(screen.getByText("PAAQ")).toBeInTheDocument();
    expect(screen.getByText("Hub")).toBeInTheDocument();
  });

  it("renders the empty state when no village bases exist", async () => {
    listCompanyBases.mockResolvedValueOnce({
      items: [makeBase({ is_hub: true })],
      total: 1,
    });

    await renderPage();

    expect(screen.getByText(/no village bases configured/i)).toBeInTheDocument();
    expect(batchWeather).not.toHaveBeenCalled();
  });

  it("surfaces partial weather errors", async () => {
    listCompanyBases.mockResolvedValueOnce({
      items: [makeBase({ icao: "PAAQ" })],
      total: 1,
    });
    batchWeather.mockResolvedValueOnce({
      items: [],
      errors: [
        {
          icao: "PAAQ",
          kind: "metar",
          status: 502,
          detail: "AWC upstream timeout",
        },
      ],
    });

    await renderPage();

    expect(screen.getByText(/fetch problem/i)).toBeInTheDocument();
    expect(screen.getByText(/AWC upstream timeout/)).toBeInTheDocument();
  });

  it("shows session-expired alert on 401", async () => {
    listCompanyBases.mockRejectedValueOnce(
      new TestApiError(401, "/bases", "x"),
    );

    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(/session expired/i);
  });
});
