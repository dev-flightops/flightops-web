import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { InspectionSummary } from "@/lib/api/inspections";

const { TestApiError, listInspections, auth } = vi.hoisted(() => {
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
    listInspections: vi.fn(),
    auth: vi.fn(async () => ({ roles: ["maintenance"] as string[] })),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/inspections", () => ({ listInspections }));
vi.mock("@/auth", () => ({ auth }));

import InspectionsPage from "./page";

function inspection(over: Partial<InspectionSummary> = {}): InspectionSummary {
  return {
    id: "i-1",
    aircraft_id: "a-1",
    tail_number: "N207GE",
    aircraft_model: "PC-12",
    inspection_type: "annual",
    type_label: "Annual",
    title: "Annual 2026",
    status: "in_progress",
    started_on: "2026-11-02",
    target_on: "2026-11-09",
    aircraft_hours_at_start: 4210.4,
    assigned_to_user_id: "u-1",
    assigned_to_name: "Pat Mechanic",
    vendor_id: null,
    vendor_name: null,
    work_order_id: null,
    wo_number: null,
    notes: null,
    progress: { total: 10, passed: 6, corrected: 1, open_discrepancies: 2, pending: 1, pct: 70, ready: false },
    signed_off_on: null,
    signed_off_at: null,
    signer_name: null,
    cert_number: null,
    cert_type: null,
    total_time_hours: null,
    sign_off_notes: null,
    due_item_id: null,
    due_item_title: null,
    ...over,
  };
}

const COUNTS = { active: 1, ready: 0, signed_off: 3, cancelled: 0 };

async function show(params: Record<string, string> = {}) {
  render(await InspectionsPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  auth.mockResolvedValue({ roles: ["maintenance"] });
  listInspections.mockReset();
});

describe("Inspection Tracker (#178)", () => {
  it("lists active inspections with their progress and open discrepancies", async () => {
    listInspections.mockResolvedValue({ items: [inspection()], counts: COUNTS });
    await show();
    expect(listInspections).toHaveBeenCalledWith("active");
    const row = screen.getByRole("row", { name: /Annual 2026/ });
    expect(within(row).getByText("N207GE")).toBeInTheDocument();
    expect(within(row).getByText("7/10 items")).toBeInTheDocument();
    expect(within(row).getByText("2 discrepancies open")).toBeInTheDocument();
    expect(within(row).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "70");
    expect(within(row).getByText("Pat Mechanic")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Active · 1" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Signed off · 3" })).toHaveAttribute(
      "href",
      "/maintenance/inspections?view=signed_off",
    );
  });

  it("shows who signed in the signed-off view", async () => {
    listInspections.mockResolvedValue({
      items: [
        inspection({
          status: "signed_off",
          signed_off_on: "2026-11-08",
          signer_name: "Pat Mechanic",
          cert_number: "3456789",
          progress: { total: 2, passed: 2, corrected: 0, open_discrepancies: 0, pending: 0, pct: 100, ready: true },
        }),
      ],
      counts: COUNTS,
    });
    await show({ view: "signed_off" });
    expect(listInspections).toHaveBeenCalledWith("signed_off");
    expect(screen.getByRole("columnheader", { name: "Signed Off" })).toBeInTheDocument();
    expect(screen.getByText("3456789")).toBeInTheDocument();
  });

  it("starts one from an empty list, for the shop only", async () => {
    listInspections.mockResolvedValue({ items: [], counts: { ...COUNTS, active: 0 } });
    await show();
    expect(screen.getByText("No inspections in progress.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start Inspection" })).toHaveAttribute("href", "/maintenance/inspections/new");

    document.body.innerHTML = "";
    auth.mockResolvedValue({ roles: ["pilot"] });
    await show();
    expect(screen.queryByRole("link", { name: "+ New Inspection" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Start Inspection" })).not.toBeInTheDocument();
  });

  it("falls back to the active view on an unknown one", async () => {
    listInspections.mockResolvedValue({ items: [], counts: COUNTS });
    await show({ view: "everything" });
    expect(listInspections).toHaveBeenCalledWith("active");
  });

  it("says so when it can't load", async () => {
    listInspections.mockRejectedValue(new TestApiError(500, "/inspections", "boom"));
    await show();
    expect(screen.getByRole("alert")).toHaveTextContent("unavailable");
  });
});
