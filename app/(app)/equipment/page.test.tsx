import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GSEUnitListItem } from "@/lib/api/types";

const { TestApiError, listGseUnits } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, listGseUnits: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({ listGseUnits }));

import EquipmentPage from "./page";

function makeUnit(overrides: Partial<GSEUnitListItem>): GSEUnitListItem {
  return {
    id: "u-1",
    name: "Tug A-12",
    equipment_type: "tug",
    make: "Eagle",
    model: "TT-50",
    serial_number: "EA-12345",
    year: 2018,
    station: { id: "s-1", icao_code: "PANC", name: "Anchorage" },
    status: "operational",
    status_note: null,
    last_service_date: "2026-05-01",
    next_service_date: "2026-08-01",
    service_interval_days: 90,
    hours_total: 412.5,
    purchase_date: null,
    manufacturer: null,
    is_active: true,
    notes: null,
    open_squawk_count: 0,
    ...overrides,
  };
}

beforeEach(() => {
  listGseUnits.mockReset();
});

async function renderPage(
  searchParams: { status?: string; type?: string; station?: string } = {},
) {
  const ui = await EquipmentPage({
    searchParams: Promise.resolve(searchParams),
  });
  return render(ui);
}

describe("EquipmentPage (M2-G-39)", () => {
  it("renders the title + subtitle", async () => {
    listGseUnits.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByRole("heading", {
        name: /ground support equipment/i,
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/service tracking/i)).toBeInTheDocument();
  });

  it("computes stats from the unit list", async () => {
    listGseUnits.mockResolvedValueOnce({
      items: [
        makeUnit({ id: "a", name: "A", status: "operational" }),
        makeUnit({ id: "b", name: "B", status: "operational" }),
        makeUnit({ id: "c", name: "C", status: "maintenance" }),
        makeUnit({ id: "d", name: "D", status: "out_of_service" }),
      ],
      total: 4,
    });

    await renderPage();

    // The label "Operational" appears in both the stat tile and the
    // filter dropdown; the tile is the first occurrence in DOM order.
    const tileLabel = (text: string) =>
      screen.getAllByText(text)[0].previousSibling?.textContent;
    expect(tileLabel("Total Units")).toBe("4");
    expect(tileLabel("Operational")).toBe("2");
    expect(tileLabel("In Maintenance")).toBe("1");
    // Needs attention = maintenance + out_of_service = 2
    expect(tileLabel("Needs Attention")).toBe("2");
  });

  it("groups units by station", async () => {
    listGseUnits.mockResolvedValueOnce({
      items: [
        makeUnit({
          id: "a",
          name: "Tug A-12",
          station: { id: "s-1", icao_code: "PANC", name: "Anchorage" },
        }),
        makeUnit({
          id: "b",
          name: "GPU #3",
          equipment_type: "gpu",
          station: { id: "s-2", icao_code: "PABE", name: "Bethel" },
        }),
        makeUnit({ id: "c", name: "Belt #1", station: null }),
      ],
      total: 3,
    });

    await renderPage();

    expect(
      screen.getByRole("heading", { name: "PANC", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "PABE", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Unassigned", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Tug A-12")).toBeInTheDocument();
    expect(screen.getByText("GPU #3")).toBeInTheDocument();
  });

  it("shows the open-squawk chip when count > 0", async () => {
    listGseUnits.mockResolvedValueOnce({
      items: [makeUnit({ open_squawk_count: 2 })],
      total: 1,
    });

    await renderPage();

    expect(screen.getByText(/2 open/i)).toBeInTheDocument();
  });

  it("passes status + type filters to the API client", async () => {
    listGseUnits.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage({ status: "maintenance", type: "tug" });

    expect(listGseUnits).toHaveBeenCalledWith({
      status: "maintenance",
      equipmentType: "tug",
      limit: 500,
    });
  });

  it("filters by station client-side without re-fetching", async () => {
    listGseUnits.mockResolvedValueOnce({
      items: [
        makeUnit({
          id: "anc",
          name: "Tug A",
          station: { id: "s-1", icao_code: "PANC", name: "Anchorage" },
        }),
        makeUnit({
          id: "bet",
          name: "Tug B",
          station: { id: "s-2", icao_code: "PABE", name: "Bethel" },
        }),
      ],
      total: 2,
    });

    await renderPage({ station: "PANC" });

    // Only the PANC group shows up in the rendered table
    expect(screen.getByText("Tug A")).toBeInTheDocument();
    expect(screen.queryByText("Tug B")).not.toBeInTheDocument();
  });

  it("ignores unknown filter values", async () => {
    listGseUnits.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage({ status: "bogus", type: "spaceship" });

    expect(listGseUnits).toHaveBeenCalledWith({
      status: undefined,
      equipmentType: undefined,
      limit: 500,
    });
  });

  it("shows the empty state when filters match nothing", async () => {
    listGseUnits.mockResolvedValueOnce({
      items: [
        makeUnit({
          station: { id: "s-1", icao_code: "PANC", name: "Anchorage" },
        }),
      ],
      total: 1,
    });

    await renderPage({ station: "ELSEWHERE" });

    expect(
      screen.getByText(/no equipment matches the current filters/i),
    ).toBeInTheDocument();
  });

  it("renders the session-expired alert on 401", async () => {
    listGseUnits.mockRejectedValueOnce(
      new TestApiError(401, "/ground/gse", "Unauthorized"),
    );

    await renderPage();

    expect(screen.getByText(/session expired/i)).toBeInTheDocument();
  });

  it("renders the generic error alert on 5xx", async () => {
    listGseUnits.mockRejectedValueOnce(
      new TestApiError(502, "/ground/gse", "Bad Gateway"),
    );

    await renderPage();

    expect(screen.getByText(/equipment feed unavailable/i)).toBeInTheDocument();
  });
});
