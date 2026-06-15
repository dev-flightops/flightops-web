import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GSEUnitListItem } from "@/lib/api/types";

const {
  TestApiError,
  listStations,
  listOpenStationIssues,
  listGseUnits,
} = vi.hoisted(() => {
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
    listStations: vi.fn(),
    listOpenStationIssues: vi.fn(),
    listGseUnits: vi.fn(),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({
  listStations,
  listOpenStationIssues,
  listGseUnits,
}));

import GroundOpsHubPage from "./page";

function makeGseUnit(
  overrides: Partial<GSEUnitListItem> = {},
): GSEUnitListItem {
  return {
    id: "u-1",
    name: "Tug A-12",
    equipment_type: "tug",
    make: null,
    model: null,
    serial_number: null,
    year: null,
    station: null,
    status: "operational",
    status_note: null,
    last_service_date: null,
    next_service_date: null,
    service_interval_days: null,
    hours_total: 0,
    purchase_date: null,
    manufacturer: null,
    is_active: true,
    notes: null,
    open_squawk_count: 0,
    ...overrides,
  };
}

beforeEach(() => {
  listStations.mockReset();
  listOpenStationIssues.mockReset();
  listGseUnits.mockReset();
});

async function renderPage() {
  const ui = await GroundOpsHubPage();
  return render(ui);
}

describe("GroundOpsHubPage", () => {
  it("renders title + subtitle + four section cards", async () => {
    listStations.mockResolvedValueOnce({ items: [], total: 0 });
    listOpenStationIssues.mockResolvedValueOnce({ items: [], total: 0 });
    listGseUnits.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByRole("heading", { name: /ground operations/i, level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^ramp operations$/i, level: 3 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^station management$/i, level: 3 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /ground support equipment/i, level: 3 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^fuel management$/i, level: 3 }),
    ).toBeInTheDocument();
  });

  it("renders the six stat tiles with real and placeholder values", async () => {
    listStations.mockResolvedValueOnce({ items: [], total: 14 });
    listOpenStationIssues.mockResolvedValueOnce({ items: [], total: 3 });
    listGseUnits.mockResolvedValueOnce({
      items: [
        makeGseUnit({ id: "a", status: "operational" }),
        makeGseUnit({ id: "b", status: "maintenance" }),
        makeGseUnit({ id: "c", status: "out_of_service" }),
      ],
      total: 3,
    });

    await renderPage();

    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("3 open")).toBeInTheDocument();
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getByText(/^flights today$/i)).toBeInTheDocument();
    expect(screen.getByText(/^pending fuel$/i)).toBeInTheDocument();
  });

  it("Station Management has live All Stations + Station Issues + dimmed Add Station", async () => {
    listStations.mockResolvedValueOnce({ items: [], total: 7 });
    listOpenStationIssues.mockResolvedValueOnce({ items: [], total: 0 });
    listGseUnits.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    const allStations = screen.getByRole("link", { name: /all stations/i });
    expect(allStations).toHaveAttribute("href", "/stations");

    // Add Station is dimmed (rendered as a <div>, not a <Link>) until M2-G-38b.
    expect(
      screen.queryByRole("link", { name: /add station/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/add station/i)).toBeInTheDocument();
  });

  it("Equipment Dashboard is live and Add Equipment is dimmed", async () => {
    listStations.mockResolvedValueOnce({ items: [], total: 0 });
    listOpenStationIssues.mockResolvedValueOnce({ items: [], total: 0 });
    listGseUnits.mockResolvedValueOnce({ items: [], total: 4 });

    await renderPage();

    const equipmentDashboard = screen.getByRole("link", {
      name: /equipment dashboard/i,
    });
    expect(equipmentDashboard).toHaveAttribute("href", "/equipment");

    expect(
      screen.queryByRole("link", { name: /add equipment/i }),
    ).not.toBeInTheDocument();
  });

  it("renders dimmed Ramp + Fuel sub-links with Coming in M2 markers", async () => {
    listStations.mockResolvedValueOnce({ items: [], total: 0 });
    listOpenStationIssues.mockResolvedValueOnce({ items: [], total: 0 });
    listGseUnits.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    // 3 Ramp + Add Station + Add Equipment + 1 Fuel Quality (3 fuel
    // sub-links flipped live in M2-G-40) = 6 dimmed entries.
    expect(screen.getAllByText(/coming in m2/i).length).toBeGreaterThanOrEqual(6);
    expect(screen.getByText(/ramp dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/^order fuel$/i)).toBeInTheDocument();
    expect(screen.getByText(/suppliers & pricing/i)).toBeInTheDocument();
  });

  it("renders the session-expired alert on 401", async () => {
    listStations.mockRejectedValueOnce(
      new TestApiError(401, "/ground/stations", "Unauthorized"),
    );
    listOpenStationIssues.mockResolvedValueOnce({ items: [], total: 0 });
    listGseUnits.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(screen.getByText(/session expired/i)).toBeInTheDocument();
  });

  it("shows the generic data-unavailable alert on 5xx", async () => {
    listStations.mockRejectedValueOnce(
      new TestApiError(502, "/ground/stations", "Bad Gateway"),
    );
    listOpenStationIssues.mockResolvedValueOnce({ items: [], total: 0 });
    listGseUnits.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByText(/ground ops data unavailable/i),
    ).toBeInTheDocument();
  });
});
