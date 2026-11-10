import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, createShipment, updateShipmentStatus, revalidatePath } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, createShipment: vi.fn(), updateShipmentStatus: vi.fn(), revalidatePath: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/part-logistics", () => ({ createShipment, updateShipmentStatus }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { createShipmentAction, updateShipmentStatusAction } from "./actions";

const PART = "0b6c6b1e-2d4c-4c4e-9a8f-1f2e3d4c5b6a";
const VENDOR = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

beforeEach(() => {
  createShipment.mockReset();
  updateShipmentStatus.mockReset();
});

describe("entering a shipment (#178)", () => {
  it("between bases needs where it's going, and ships at once", async () => {
    const missing = await createShipmentAction({ status: "idle" }, form({ kind: "transfer", part_id: PART, quantity: "4" }));
    expect(missing).toEqual({ status: "field-errors", errors: { dest_base: "Pick the base it's going to." } });

    createShipment.mockResolvedValue({ part_number: "CH48110-1", origin_base: "PABE", dest_base: "PADQ" });
    const saved = await createShipmentAction(
      { status: "idle" },
      form({ kind: "transfer", part_id: PART, quantity: "4", dest_base: "PADQ", vendor_id: VENDOR, status: "ordered" }),
    );
    expect(saved).toEqual({ status: "saved", message: "CH48110-1 shipped from PABE to PADQ." });
    expect(createShipment).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "transfer", part_id: PART, quantity: "4", dest_base: "PADQ", vendor_id: null, status: "shipped" }),
    );
  });

  it("from a vendor needs the vendor, and is ordered unless said otherwise", async () => {
    const missing = await createShipmentAction({ status: "idle" }, form({ kind: "vendor", part_id: PART, quantity: "6" }));
    expect(missing).toEqual({ status: "field-errors", errors: { vendor_id: "Pick the vendor sending it." } });

    createShipment.mockResolvedValue({ part_number: "CH48110-1", vendor_name: "Aircraft Spruce", dest_base: "PADQ" });
    await createShipmentAction({ status: "idle" }, form({ kind: "vendor", part_id: PART, quantity: "6", vendor_id: VENDOR, dest_base: "PANC" }));
    expect(createShipment).toHaveBeenCalledWith(expect.objectContaining({ vendor_id: VENDOR, dest_base: null, status: "ordered" }));
  });

  it("needs a quantity above zero", async () => {
    const state = await createShipmentAction({ status: "idle" }, form({ kind: "transfer", part_id: PART, quantity: "0", dest_base: "PADQ" }));
    expect(state).toEqual({ status: "field-errors", errors: { quantity: "Give a quantity above zero." } });
  });

  it("passes the service's refusal on", async () => {
    createShipment.mockRejectedValue(new TestApiError(409, "/x", JSON.stringify({ detail: "Only 2 EA of CH48110-1 on hand at PABE." })));
    const state = await createShipmentAction({ status: "idle" }, form({ kind: "transfer", part_id: PART, quantity: "3", dest_base: "PADQ" }));
    expect(state).toEqual({ status: "api-error", message: "Only 2 EA of CH48110-1 on hand at PABE." });
  });
});

describe("a shipment's status (#178)", () => {
  it("marks it arrived on the day given", async () => {
    updateShipmentStatus.mockResolvedValue({});
    expect(await updateShipmentStatusAction("s-1", { status: "arrived", on: "2026-11-09" })).toEqual({ ok: true });
    expect(updateShipmentStatus).toHaveBeenCalledWith("s-1", { status: "arrived", on: "2026-11-09" });
    expect(await updateShipmentStatusAction("s-1", { status: "arrived", on: "9/11" })).toEqual({ ok: false, message: "Give a date." });
  });
});
