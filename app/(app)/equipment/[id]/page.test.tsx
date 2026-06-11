import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  GSEMaintenanceItemResponse,
  GSESquawkResponse,
  GSEUnitListItem,
} from "@/lib/api/types";

const {
  TestApiError,
  getGseUnit,
  listGseMaintenance,
  listGseSquawks,
  notFoundSpy,
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
    getGseUnit: vi.fn(),
    listGseMaintenance: vi.fn(),
    listGseSquawks: vi.fn(),
    notFoundSpy: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({
  getGseUnit,
  listGseMaintenance,
  listGseSquawks,
}));
vi.mock("next/navigation", () => ({ notFound: notFoundSpy }));

import EquipmentDetailPage from "./page";

function makeUnit(overrides: Partial<GSEUnitListItem> = {}): GSEUnitListItem {
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
    manufacturer: "Eagle Industries",
    is_active: true,
    notes: null,
    open_squawk_count: 0,
    ...overrides,
  };
}

function makeMx(
  overrides: Partial<GSEMaintenanceItemResponse> = {},
): GSEMaintenanceItemResponse {
  return {
    id: "mx-1",
    gse_unit_id: "u-1",
    title: "100hr inspection",
    description: null,
    item_type: "inspection",
    interval_days: null,
    interval_hours: 100,
    last_completed_date: null,
    last_completed_hours: 400,
    due_date: null,
    due_hours: 500,
    status: "current",
    is_recurring: true,
    is_active: true,
    ...overrides,
  };
}

function makeSquawk(
  overrides: Partial<GSESquawkResponse> = {},
): GSESquawkResponse {
  return {
    id: "sq-1",
    gse_unit_id: "u-1",
    description: "Tug right tire low",
    reported_date: "2026-06-10",
    reported_by: { id: "u-x", full_name: "Ramper", email: "r@x" },
    status: "open",
    resolved_date: null,
    resolved_by: null,
    resolution_notes: null,
    created_at: "2026-06-10T14:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  getGseUnit.mockReset();
  listGseMaintenance.mockReset();
  listGseSquawks.mockReset();
  notFoundSpy.mockClear();
});

async function renderPage(id = "u-1") {
  const ui = await EquipmentDetailPage({
    params: Promise.resolve({ id }),
  });
  return render(ui);
}

describe("EquipmentDetailPage (M2-G-39)", () => {
  it("renders the unit header + meta + back link", async () => {
    getGseUnit.mockResolvedValueOnce(makeUnit());
    listGseMaintenance.mockResolvedValueOnce({ items: [], total: 0 });
    listGseSquawks.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByRole("heading", { name: "Tug A-12", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /equipment/i }),
    ).toHaveAttribute("href", "/equipment");
    expect(screen.getByText("Eagle TT-50")).toBeInTheDocument();
    expect(screen.getByText("EA-12345")).toBeInTheDocument();
    expect(screen.getByText("PANC")).toBeInTheDocument();
  });

  it("renders the scheduled-maintenance table", async () => {
    getGseUnit.mockResolvedValueOnce(makeUnit());
    listGseMaintenance.mockResolvedValueOnce({
      items: [makeMx()],
      total: 1,
    });
    listGseSquawks.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByText(/scheduled maintenance \(1\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText("100hr inspection")).toBeInTheDocument();
    expect(screen.getByText("100 h")).toBeInTheDocument();
    expect(screen.getByText("500 h")).toBeInTheDocument();
  });

  it("splits open and resolved squawks into separate sections", async () => {
    getGseUnit.mockResolvedValueOnce(makeUnit());
    listGseMaintenance.mockResolvedValueOnce({ items: [], total: 0 });
    listGseSquawks.mockResolvedValueOnce({
      items: [
        makeSquawk(),
        makeSquawk({
          id: "sq-2",
          description: "Old brake job",
          status: "resolved",
          resolved_date: "2026-06-09",
          resolution_notes: "Bled brakes; clean.",
        }),
      ],
      total: 2,
    });

    await renderPage();

    expect(screen.getByText(/open squawks \(1\)/i)).toBeInTheDocument();
    expect(
      screen.getByText(/recently resolved \(1\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Tug right tire low")).toBeInTheDocument();
    expect(screen.getByText("Bled brakes; clean.")).toBeInTheDocument();
  });

  it("surfaces the status_note when set (e.g. unit is out of service)", async () => {
    getGseUnit.mockResolvedValueOnce(
      makeUnit({
        status: "out_of_service",
        status_note: "Hydraulic pump failure; parts on order",
      }),
    );
    listGseMaintenance.mockResolvedValueOnce({ items: [], total: 0 });
    listGseSquawks.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByText(/hydraulic pump failure/i),
    ).toBeInTheDocument();
  });

  it("calls notFound when the unit is missing", async () => {
    getGseUnit.mockRejectedValueOnce(
      new TestApiError(404, "/ground/gse/x", ""),
    );
    listGseMaintenance.mockResolvedValueOnce({ items: [], total: 0 });
    listGseSquawks.mockResolvedValueOnce({ items: [], total: 0 });

    await expect(renderPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundSpy).toHaveBeenCalledTimes(1);
  });

  it("renders the session-expired alert on 401", async () => {
    getGseUnit.mockRejectedValueOnce(
      new TestApiError(401, "/ground/gse/x", "Unauthorized"),
    );
    listGseMaintenance.mockResolvedValueOnce({ items: [], total: 0 });
    listGseSquawks.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(screen.getByText(/session expired/i)).toBeInTheDocument();
  });

  it("renders the generic error alert on 5xx", async () => {
    getGseUnit.mockRejectedValueOnce(
      new TestApiError(502, "/ground/gse/x", "Bad Gateway"),
    );
    listGseMaintenance.mockResolvedValueOnce({ items: [], total: 0 });
    listGseSquawks.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(screen.getByText(/equipment unavailable/i)).toBeInTheDocument();
  });
});
