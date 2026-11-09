import { render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PartShipment } from "@/lib/api/part-logistics";

const { listShipments, listParts, listPartBases, listVendors, auth } = vi.hoisted(() => ({
  listShipments: vi.fn(),
  listParts: vi.fn(),
  listPartBases: vi.fn(),
  listVendors: vi.fn(),
  auth: vi.fn(async () => ({ roles: ["maintenance"] as string[] })),
}));
vi.mock("@/lib/api/part-logistics", () => ({ listShipments }));
vi.mock("@/lib/api/maintenance", () => ({ listParts, listPartBases }));
vi.mock("@/lib/api/mx-vendors", () => ({ listVendors }));
vi.mock("@/lib/api/auth", () => ({ loadZoneTable: vi.fn(async () => ({ fallback: "America/Anchorage" })) }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("./actions", () => ({ createShipmentAction: vi.fn(), updateShipmentStatusAction: vi.fn() }));
// The form keeps its state with useActionState, which this test runner's React lacks.
const { formProps } = vi.hoisted(() => ({ formProps: [] as unknown[] }));
vi.mock("./new-shipment-form", () => ({
  NewShipmentForm: (props: unknown) => {
    formProps.push(props);
    return <form aria-label="New shipment" />;
  },
}));

import type { NewShipmentForm } from "./new-shipment-form";
import ShippingPage from "./page";

type FormProps = ComponentProps<typeof NewShipmentForm>;

function shipment(over: Partial<PartShipment> = {}): PartShipment {
  return {
    id: "s-1",
    kind: "transfer",
    status: "shipped",
    part_id: "p-1",
    dest_part_id: "p-2",
    part_number: "CH48110-1",
    description: "Oil filter",
    unit: "EA",
    batch_number: "B7",
    lot_number: null,
    quantity: 4,
    origin_base: "PABE",
    dest_base: "PADQ",
    vendor_id: null,
    vendor_name: null,
    airway_bill: "AWB-123",
    carrier: "Everts",
    shipped_on: "2026-11-09",
    est_arrival_on: null,
    arrived_on: null,
    work_order_id: null,
    wo_number: null,
    notes: null,
    request_id: null,
    created_by_name: "Pat",
    created_at: "2026-11-09T20:00:00Z",
    ...over,
  };
}

async function show(params: Record<string, string> = {}) {
  render(await ShippingPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  formProps.length = 0;
  auth.mockResolvedValue({ roles: ["maintenance"] });
  listParts.mockResolvedValue({
    items: [
      { id: "p-1", part_number: "CH48110-1", description: "Oil filter", batch_number: "B7", base: "PABE", qty_on_hand: 6, unit: "EA" },
      { id: "p-3", part_number: "NOBASE", description: "Tie wrap", batch_number: null, base: null, qty_on_hand: 50, unit: "EA" },
    ],
    total: 2,
    low_count: 0,
  });
  listPartBases.mockResolvedValue([
    { code: "PABE", name: "Bethel" },
    { code: "PADQ", name: "Kodiak" },
  ]);
  listVendors.mockResolvedValue([{ id: "v-1", name: "Aircraft Spruce" }]);
});

describe("Parts Shipping (#178)", () => {
  it("lists what's on its way, from where to where", async () => {
    listShipments.mockResolvedValue([shipment(), shipment({ id: "s-2", kind: "vendor", status: "ordered", origin_base: null, vendor_name: "Aircraft Spruce", dest_part_id: "p-9" })]);
    await show();
    expect(listShipments).toHaveBeenCalledWith("open");
    const transfer = screen.getAllByRole("row").find((r) => r.textContent?.includes("AWB-123") && r.textContent?.includes("PABE"))!;
    expect(within(transfer).getByText("PABE → PADQ")).toBeInTheDocument();
    expect(within(transfer).getByText("Shipped")).toBeInTheDocument();
    expect(within(transfer).getByRole("link", { name: "CH48110-1" })).toHaveAttribute("href", "/maintenance/inventory/p-2");
    expect(screen.getByText("Aircraft Spruce")).toBeInTheDocument();
    expect(screen.getByText("Ordered")).toBeInTheDocument();
  });

  it("offers the shop the form, with each line's base and count, the bases and the vendors", async () => {
    listShipments.mockResolvedValue([]);
    await show({ part: "p-1" });
    expect(screen.getByRole("form", { name: "New shipment" })).toBeInTheDocument();
    const props = formProps[0] as FormProps;
    expect(props.defaultPartId).toBe("p-1");
    expect(props.stock).toEqual([
      { id: "p-1", base: "PABE", label: "CH48110-1 · Oil filter · batch B7 · PABE (6 EA)" },
      { id: "p-3", base: null, label: "NOBASE · Tie wrap · no base (50 EA)" },
    ]);
    expect(props.bases.map((b) => b.code)).toEqual(["PABE", "PADQ"]);
    expect(props.vendors).toEqual([{ value: "v-1", label: "Aircraft Spruce" }]);
  });

  it("reads only, for staff outside the shop", async () => {
    auth.mockResolvedValue({ roles: ["dispatcher"] });
    listShipments.mockResolvedValue([shipment()]);
    await show();
    expect(screen.queryByRole("form", { name: "New shipment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Arrived" })).not.toBeInTheDocument();
    expect(listParts).not.toHaveBeenCalled();
  });

  it("switches views", async () => {
    listShipments.mockResolvedValue([]);
    await show({ view: "arrived" });
    expect(listShipments).toHaveBeenCalledWith("arrived");
    expect(screen.getByRole("link", { name: "Arrived" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("No shipments here.")).toBeInTheDocument();
  });
});
