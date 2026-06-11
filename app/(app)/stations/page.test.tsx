import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StationListItem } from "@/lib/api/types";

const { TestApiError, listStations } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, listStations: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({ listStations }));

import StationsPage from "./page";

function makeStation(overrides: Partial<StationListItem>): StationListItem {
  return {
    id: "s-1",
    icao_code: "PANC",
    name: "Ted Stevens Anchorage Intl",
    city: "Anchorage",
    state: "AK",
    elevation_ft: 152,
    has_reporting_function: true,
    runway_length_ft: 10897,
    runway_width_ft: 200,
    runway_primary_name: "7R/25L",
    runway_source: "faa_api",
    runway_cache_updated_at: "2026-05-01T12:00:00Z",
    latitude: 61.1742,
    longitude: -149.9962,
    notes: null,
    open_issue_count: 0,
    ...overrides,
  };
}

beforeEach(() => {
  listStations.mockReset();
});

async function renderPage() {
  const ui = await StationsPage();
  return render(ui);
}

describe("StationsPage", () => {
  it("renders the legacy Ground Ops header + subtitle", async () => {
    listStations.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByRole("heading", { name: /^ground ops$/i, level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/stations, issue tracker, crew/i),
    ).toBeInTheDocument();
  });

  it("renders the three header action buttons (all dimmed)", async () => {
    listStations.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByRole("button", { name: /issue tracker/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /\+ report issue/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /\+ add station/i }),
    ).toBeDisabled();
  });

  it("fetches with the page limit", async () => {
    listStations.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(listStations).toHaveBeenCalledWith({ limit: 200 });
  });

  it("renders one row per station with ICAO, name, runway, source, Grant Stn cell, View link", async () => {
    listStations.mockResolvedValueOnce({
      items: [
        makeStation({}),
        makeStation({
          id: "s-2",
          icao_code: "PABE",
          name: "Bethel",
          runway_length_ft: 6403,
          runway_width_ft: 150,
          runway_source: "seeded",
        }),
      ],
      total: 2,
    });

    await renderPage();

    expect(screen.getByText("PANC")).toBeInTheDocument();
    expect(screen.getByText("PABE")).toBeInTheDocument();
    expect(
      screen.getByText("Ted Stevens Anchorage Intl"),
    ).toBeInTheDocument();
    expect(screen.getByText(/FAA API/i)).toBeInTheDocument();
    expect(screen.getByText(/seeded/i)).toBeInTheDocument();

    // Each row has FAA / Override / Edit dimmed buttons + a live View link
    expect(screen.getAllByRole("button", { name: /↻ faa/i }).length).toBe(2);
    expect(
      screen.getAllByRole("button", { name: /✎ override/i }).length,
    ).toBe(2);
    expect(screen.getAllByRole("button", { name: /^edit$/i }).length).toBe(
      2,
    );

    const viewLinks = screen.getAllByRole("link", { name: /view/i });
    expect(viewLinks[0]).toHaveAttribute("href", "/stations/s-1");
    expect(viewLinks[1]).toHaveAttribute("href", "/stations/s-2");
  });

  it("tags SHORT runways under 2500 ft and CAUTION 2500–4000 ft", async () => {
    listStations.mockResolvedValueOnce({
      items: [
        makeStation({
          id: "short",
          icao_code: "PAGZ",
          runway_length_ft: 2000,
          runway_width_ft: 60,
        }),
        makeStation({
          id: "caution",
          icao_code: "PAKW",
          runway_length_ft: 3500,
          runway_width_ft: 75,
        }),
      ],
      total: 2,
    });

    await renderPage();

    expect(screen.getByText(/^short$/i)).toBeInTheDocument();
    expect(screen.getByText(/^caution$/i)).toBeInTheDocument();
  });

  it("renders the YES reporting chip when the station reports", async () => {
    listStations.mockResolvedValueOnce({
      items: [makeStation({ has_reporting_function: true })],
      total: 1,
    });

    await renderPage();

    expect(screen.getAllByText(/^yes$/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders the empty state when there are no stations", async () => {
    listStations.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByText(/no stations yet\. add your first station above\./i),
    ).toBeInTheDocument();
  });

  it("renders the session-expired alert on 401", async () => {
    listStations.mockRejectedValueOnce(
      new TestApiError(401, "/ground/stations", "Unauthorized"),
    );

    await renderPage();

    expect(screen.getByText(/session expired/i)).toBeInTheDocument();
  });

  it("renders the generic error alert on 5xx", async () => {
    listStations.mockRejectedValueOnce(
      new TestApiError(502, "/ground/stations", "Bad Gateway"),
    );

    await renderPage();

    expect(screen.getByText(/stations feed unavailable/i)).toBeInTheDocument();
  });
});
