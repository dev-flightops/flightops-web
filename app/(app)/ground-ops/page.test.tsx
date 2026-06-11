import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, listStations, listOpenStationIssues } = vi.hoisted(
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
      listStations: vi.fn(),
      listOpenStationIssues: vi.fn(),
    };
  },
);
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({
  listStations,
  listOpenStationIssues,
}));

import GroundOpsHubPage from "./page";

beforeEach(() => {
  listStations.mockReset();
  listOpenStationIssues.mockReset();
});

async function renderPage() {
  const ui = await GroundOpsHubPage();
  return render(ui);
}

describe("GroundOpsHubPage (M2-G-38)", () => {
  it("renders the title + subtitle", async () => {
    listStations.mockResolvedValueOnce({ items: [], total: 0 });
    listOpenStationIssues.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByRole("heading", { name: /ground operations/i, level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^ramp operations$/i, level: 3 }),
    ).toBeInTheDocument();
  });

  it("shows the station + open-issue counts in the stat strip", async () => {
    listStations.mockResolvedValueOnce({ items: [], total: 14 });
    listOpenStationIssues.mockResolvedValueOnce({ items: [], total: 3 });

    await renderPage();

    // 14 = stations, 3 = open issues
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/3 open/i)).toBeInTheDocument();
  });

  it("renders the live Station Management section with two links", async () => {
    listStations.mockResolvedValueOnce({ items: [], total: 7 });
    listOpenStationIssues.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    const stationsLink = screen.getAllByRole("link", {
      name: /all stations/i,
    });
    expect(stationsLink[0]).toHaveAttribute("href", "/stations");
  });

  it("shows the M2 placeholder for GSE / Fuel / Ramp sections", async () => {
    listStations.mockResolvedValueOnce({ items: [], total: 0 });
    listOpenStationIssues.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(screen.getAllByText(/coming in m2/i).length).toBeGreaterThanOrEqual(
      3,
    );
  });

  it("renders the session-expired alert on 401", async () => {
    listStations.mockRejectedValueOnce(
      new TestApiError(401, "/ground/stations", "Unauthorized"),
    );
    listOpenStationIssues.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(screen.getByText(/session expired/i)).toBeInTheDocument();
  });
});
