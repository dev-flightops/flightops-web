import { render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PartRequest } from "@/lib/api/part-logistics";

const { listPartRequests, listParts, listPartBases, auth } = vi.hoisted(() => ({
  listPartRequests: vi.fn(),
  listParts: vi.fn(),
  listPartBases: vi.fn(),
  auth: vi.fn(async () => ({ roles: ["maintenance"] as string[] })),
}));
vi.mock("@/lib/api/part-logistics", () => ({ listPartRequests }));
vi.mock("@/lib/api/maintenance", () => ({ listParts, listPartBases }));
vi.mock("@/lib/api/auth", () => ({ loadZoneTable: vi.fn(async () => ({ fallback: "America/Anchorage" })) }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("./actions", () => ({
  createRequestAction: vi.fn(),
  approveRequestAction: vi.fn(),
  denyRequestAction: vi.fn(),
  shipRequestAction: vi.fn(),
  cancelRequestAction: vi.fn(),
}));
// The form keeps its state with useActionState, which this test runner's React lacks.
const { formProps } = vi.hoisted(() => ({ formProps: [] as unknown[] }));
vi.mock("./new-request-form", () => ({
  NewRequestForm: (props: unknown) => {
    formProps.push(props);
    return <form aria-label="New parts request" />;
  },
}));

import type { NewRequestForm } from "./new-request-form";
import PartsRequestsPage from "./page";

type FormProps = ComponentProps<typeof NewRequestForm>;

function request(over: Partial<PartRequest> = {}): PartRequest {
  return {
    id: "r-1",
    status: "pending",
    priority: "aog",
    part_id: "p-1",
    part_number: "CH48110-1",
    description: "Oil filter",
    unit: "EA",
    batch_number: null,
    lot_number: null,
    on_hand: 8,
    quantity: 3,
    requesting_base: "PABE",
    fulfilling_base: "PANC",
    work_order_id: null,
    wo_number: null,
    notes: "N207GE down",
    requested_by_name: "Pat Mechanic",
    requested_at: "2026-11-09T20:00:00Z",
    decided_by_name: null,
    decided_at: null,
    decision_notes: null,
    shipment_id: null,
    shipment_status: null,
    airway_bill: null,
    ...over,
  };
}

async function show(params: Record<string, string> = {}) {
  render(await PartsRequestsPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  formProps.length = 0;
  auth.mockResolvedValue({ roles: ["maintenance"] });
  listParts.mockResolvedValue({
    items: [
      { id: "p-1", part_number: "CH48110-1", description: "Oil filter", batch_number: null, base: "PANC", qty_on_hand: 8, unit: "EA" },
      { id: "p-3", part_number: "NOBASE", description: "Tie wrap", batch_number: null, base: null, qty_on_hand: 50, unit: "EA" },
    ],
    total: 2,
    low_count: 0,
  });
  listPartBases.mockResolvedValue([{ code: "PABE", name: "Bethel" }]);
});

describe("Parts Requests (#178)", () => {
  it("lists a request with its priority, the bases and what the sender holds", async () => {
    listPartRequests.mockResolvedValue([request()]);
    await show();
    expect(listPartRequests).toHaveBeenCalledWith("open");
    const row = screen.getByRole("row", { name: /CH48110-1/ });
    expect(within(row).getByText("AOG")).toBeInTheDocument();
    expect(within(row).getByText("PANC → PABE")).toBeInTheDocument();
    expect(within(row).getByText("8 on hand at PANC")).toBeInTheDocument();
    expect(within(row).getByText("Pending")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(within(row).getByText(/Nov 9/)).toBeInTheDocument();
  });

  it("asks only for stock with a base, so a sender is known", async () => {
    listPartRequests.mockResolvedValue([]);
    await show({ part: "p-1" });
    expect(screen.getByRole("form", { name: "New parts request" })).toBeInTheDocument();
    const props = formProps[0] as FormProps;
    expect(props.stock).toEqual([{ id: "p-1", label: "CH48110-1 · Oil filter · at PANC (8 EA)" }]);
    expect(props.defaultPartId).toBe("p-1");
    expect(props.bases).toEqual([{ code: "PABE", name: "Bethel" }]);
  });

  it("shows a denial's reason and offers nothing more on a closed request", async () => {
    listPartRequests.mockResolvedValue([request({ status: "denied", decision_notes: "None to spare" })]);
    await show({ view: "closed" });
    const row = screen.getByRole("row", { name: /CH48110-1/ });
    expect(within(row).getByText("Denied")).toBeInTheDocument();
    expect(within(row).getByText("None to spare")).toBeInTheDocument();
    expect(within(row).queryByRole("button")).not.toBeInTheDocument();
  });

  it("reads only, for staff outside the shop", async () => {
    auth.mockResolvedValue({ roles: ["pilot"] });
    listPartRequests.mockResolvedValue([request()]);
    await show();
    expect(screen.queryByRole("form", { name: "New parts request" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });
});
