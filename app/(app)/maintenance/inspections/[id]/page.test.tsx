import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { InspectionDetail } from "@/lib/api/inspections";
import type { DueItem } from "@/lib/api/maintenance";

const { TestApiError, getInspection, listAircraftDueItems, auth } = vi.hoisted(() => {
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
    getInspection: vi.fn(),
    listAircraftDueItems: vi.fn(),
    auth: vi.fn(async () => ({ roles: ["maintenance"] as string[], user: { name: "Pat Mechanic" } })),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/inspections", () => ({ getInspection }));
vi.mock("@/lib/api/maintenance", () => ({ listAircraftDueItems }));
vi.mock("@/lib/api/auth", () => ({ loadZoneTable: vi.fn(async () => ({ fallback: "America/Anchorage" })) }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("../actions", () => ({
  passItemAction: vi.fn(),
  failItemAction: vi.fn(),
  removeItemAction: vi.fn(),
  addItemAction: vi.fn(),
  signOffAction: vi.fn(),
  cancelInspectionAction: vi.fn(),
}));

import InspectionPage from "./page";

function inspection(over: Partial<InspectionDetail> = {}): InspectionDetail {
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
    target_on: null,
    aircraft_hours_at_start: 4210.4,
    assigned_to_user_id: null,
    assigned_to_name: null,
    vendor_id: null,
    vendor_name: null,
    work_order_id: null,
    wo_number: null,
    notes: null,
    progress: { total: 2, passed: 2, corrected: 0, open_discrepancies: 0, pending: 0, pct: 100, ready: true },
    signed_off_on: null,
    signed_off_at: null,
    signer_name: null,
    cert_number: null,
    cert_type: null,
    total_time_hours: null,
    sign_off_notes: null,
    due_item_id: null,
    due_item_title: null,
    items: [],
    aircraft_total_hours: 4212.9,
    ...over,
  };
}

function due(over: Partial<DueItem>): DueItem {
  return {
    id: "d-1",
    aircraft_id: "a-1",
    tail_number: "N207GE",
    kind: "inspection",
    title: "Annual inspection",
    reference: null,
    interval_hours: null,
    interval_days: 365,
    due_hours: null,
    due_on: "2026-11-30",
    last_done_on: null,
    last_done_hours: null,
    grounds_when_overdue: true,
    is_active: true,
    notes: null,
    state: "due_soon",
    hours_left: null,
    days_left: 21,
    summary: "Annual inspection: due in 21 days",
    aircraft_total_hours: 4212.9,
    ...over,
  };
}

async function show() {
  render(await InspectionPage({ params: Promise.resolve({ id: "i-1" }) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ roles: ["maintenance"], user: { name: "Pat Mechanic" } });
  listAircraftDueItems.mockResolvedValue({
    items: [due({}), due({ id: "d-2", title: "ELT battery", kind: "component", summary: "ELT battery: due" })],
    total: 2,
    as_of: "2026-11-09",
  });
});

describe("An inspection (#178)", () => {
  it("offers the sign-off once ready, an IA for an annual, with the matching due-list item", async () => {
    getInspection.mockResolvedValue(inspection());
    await show();
    expect(screen.getByRole("form", { name: "Sign off" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Signed By/)).toHaveValue("Pat Mechanic");
    expect(screen.getByLabelText("Certificate")).toHaveValue("ia");
    expect(screen.getByLabelText(/Aircraft Total Time/)).toHaveValue("4212.9");
    expect(screen.getByLabelText(/Due-List Item/)).toHaveValue("d-1");
  });

  it("says what's left before it can be signed off", async () => {
    getInspection.mockResolvedValue(
      inspection({ progress: { total: 3, passed: 1, corrected: 0, open_discrepancies: 1, pending: 1, pct: 33, ready: false } }),
    );
    await show();
    expect(screen.queryByRole("form", { name: "Sign off" })).not.toBeInTheDocument();
    expect(screen.getByText("1 item to check and 1 discrepancy to resolve before it can be signed off.")).toBeInTheDocument();
    expect(listAircraftDueItems).not.toHaveBeenCalled();
  });

  it("doesn't offer the sign-off to staff who can't sign", async () => {
    auth.mockResolvedValue({ roles: ["dispatcher"], user: { name: "Dana" } });
    getInspection.mockResolvedValue(inspection());
    await show();
    expect(screen.queryByRole("form", { name: "Sign off" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel Inspection" })).not.toBeInTheDocument();
  });

  it("shows the sign-off on a signed inspection, with nothing left to do", async () => {
    getInspection.mockResolvedValue(
      inspection({
        status: "signed_off",
        signed_off_on: "2026-11-08",
        signer_name: "Pat Mechanic",
        cert_type: "ia",
        cert_number: "3456789",
        total_time_hours: 4210.4,
        due_item_title: "Annual inspection",
      }),
    );
    await show();
    expect(screen.getByText(/by Pat Mechanic, IA 3456789, at 4210.4 hours total time/)).toBeInTheDocument();
    expect(screen.getByText(/Recorded on the due list as Annual inspection/)).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Sign off" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("is not found for a bad id", async () => {
    getInspection.mockRejectedValue(new TestApiError(422, "/inspections/x", "bad"));
    await expect(show()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
