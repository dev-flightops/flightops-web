import { render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type {
  VillageAirportResponse,
  VillageBoardRow,
  VillageWeatherReportResponse,
} from "@/lib/api/types";

const { TestApiError, getVillageBoard, listVillageAirports } = vi.hoisted(
  () => {
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
      getVillageBoard: vi.fn(),
      listVillageAirports: vi.fn(),
    };
  },
);

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/weather", () => ({
  getVillageBoard,
  listVillageAirports,
}));
vi.mock("@/components/village-wx/add-report-dialog", () => ({
  AddReportDialog: () => <div data-testid="add-report-dialog" />,
}));
vi.mock("@/components/village-wx/add-airport-dialog", () => ({
  AddAirportDialog: () => <div data-testid="add-airport-dialog" />,
}));
vi.mock("./auto-refresh", () => ({
  AutoRefresh: () => null,
}));
vi.mock("./density-toggle", () => ({
  DensityToggle: ({ active }: { active: string }) => (
    <div data-testid="density-toggle" data-active={active} />
  ),
}));

import VillageWxPage from "./page";

function makeAirport(
  overrides: Partial<VillageAirportResponse>,
): VillageAirportResponse {
  return {
    id: "a-1",
    icao: "PABE",
    name: "Bethel",
    region: "YK Delta",
    is_active: true,
    notes: null,
    ...overrides,
  };
}

function makeReport(
  overrides: Partial<VillageWeatherReportResponse>,
): VillageWeatherReportResponse {
  return {
    id: "r-1",
    village_airport_id: "a-1",
    reported_by: { id: "u-1", full_name: "Phil B." },
    reported_by_name: "Phil B.",
    reported_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    cloud_cover: "OVC",
    ceiling_ft: 800,
    visibility_sm: 2,
    wind_dir_deg: 180,
    wind_speed_kt: 12,
    wind_gust_kt: null,
    temperature_c: -3,
    altimeter_in_hg: 29.92,
    notes: null,
    flight_category: "IFR",
    ...overrides,
  };
}

function row(
  airport: Partial<VillageAirportResponse> = {},
  report: Partial<VillageWeatherReportResponse> | null = {},
): VillageBoardRow {
  const a = makeAirport(airport);
  return {
    airport: a,
    latest_report:
      report === null
        ? null
        : makeReport({ village_airport_id: a.id, ...report }),
  };
}

beforeEach(() => {
  getVillageBoard.mockReset();
  listVillageAirports.mockReset();
  listVillageAirports.mockResolvedValue({ items: [], total: 0 });
});

afterEach(() => {
  vi.useRealTimers();
});

async function renderPage(search: { density?: string } = {}) {
  const ui = await VillageWxPage({ searchParams: Promise.resolve(search) });
  return render(ui);
}

describe("VillageWxPage (M2-G-village-wx-redesign)", () => {
  it("renders the title + header CTAs + category legend", async () => {
    getVillageBoard.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByRole("heading", {
        name: /village weather board/i,
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("add-report-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("add-airport-dialog")).toBeInTheDocument();
    // Category legend contains all four labels (incl. VFR + LIFR).
    expect(screen.getAllByText(/^VFR$/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^LIFR$/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Stale:/i)).toBeInTheDocument();
  });

  it("groups rows by region with airports listed under each", async () => {
    getVillageBoard.mockResolvedValueOnce({
      items: [
        row({ id: "a-1", icao: "PABE", name: "Bethel", region: "YK Delta" }),
        row({ id: "a-2", icao: "PADL", name: "Dillingham", region: "Bristol Bay" }),
      ],
      total: 2,
    });

    await renderPage();

    const regions = screen.getAllByRole("heading", { level: 2 });
    expect(regions.map((h) => h.textContent)).toEqual([
      "Bristol Bay",
      "YK Delta",
    ]);
    expect(screen.getByText("Bethel")).toBeInTheDocument();
    expect(screen.getByText("Dillingham")).toBeInTheDocument();
  });

  it("falls back to 'Unassigned' when an airport has no region", async () => {
    getVillageBoard.mockResolvedValueOnce({
      items: [row({ region: null })],
      total: 1,
    });

    await renderPage();

    expect(
      screen.getByRole("heading", { name: "Unassigned", level: 2 }),
    ).toBeInTheDocument();
  });

  it("renders the IFR badge + reporter footer for a fresh report", async () => {
    getVillageBoard.mockResolvedValueOnce({
      items: [row({}, {})],
      total: 1,
    });

    await renderPage();

    // "IFR" appears in both the legend and the badge — assert at least one.
    expect(screen.getAllByText("IFR").length).toBeGreaterThan(0);
    expect(screen.getByText(/by Phil B\./)).toBeInTheDocument();
  });

  it("flags a > 4hr report as STALE", async () => {
    getVillageBoard.mockResolvedValueOnce({
      items: [
        row(
          {},
          {
            reported_at: new Date(
              Date.now() - 6 * 60 * 60 * 1000,
            ).toISOString(),
          },
        ),
      ],
      total: 1,
    });

    await renderPage();

    expect(screen.getByText(/STALE/)).toBeInTheDocument();
  });

  it("renders an empty-state hint when no airports exist", async () => {
    getVillageBoard.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByText(/No village airports configured/i),
    ).toBeInTheDocument();
  });

  it("renders the 'No report yet' label when an airport has no latest report", async () => {
    getVillageBoard.mockResolvedValueOnce({
      items: [row({ name: "Aniak" }, null)],
      total: 1,
    });

    await renderPage();

    expect(screen.getByText("Aniak")).toBeInTheDocument();
    expect(screen.getByText(/No report yet/i)).toBeInTheDocument();
  });

  it("passes the density param through to the toggle", async () => {
    getVillageBoard.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage({ density: "expanded" });

    expect(screen.getByTestId("density-toggle")).toHaveAttribute(
      "data-active",
      "expanded",
    );
  });

  it("shows session-expired text when the board fetch returns 401", async () => {
    getVillageBoard.mockRejectedValueOnce(
      new TestApiError(401, "/village-board", "expired"),
    );

    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(/session expired/i);
  });

  it("shows a generic unavailable banner on 5xx", async () => {
    getVillageBoard.mockRejectedValueOnce(
      new TestApiError(500, "/village-board", "x"),
    );

    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/i);
  });
});
