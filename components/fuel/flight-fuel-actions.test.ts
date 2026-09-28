import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createFuelOrder,
  amendFuelOrder,
  cancelFuelOrder,
  getFlight,
  revalidatePath,
  TestApiError,
} = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
      this.name = "ApiError";
    }
  }
  return {
    createFuelOrder: vi.fn(),
    amendFuelOrder: vi.fn(),
    cancelFuelOrder: vi.fn(),
    getFlight: vi.fn(),
    revalidatePath: vi.fn(),
    TestApiError,
  };
});
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({ createFuelOrder, amendFuelOrder, cancelFuelOrder }));
vi.mock("@/lib/api/ops", () => ({ getFlight }));

import {
  amendFuelOrderAction,
  cancelFuelOrderAction,
  orderFuelForFlightAction,
} from "./flight-fuel-actions";

const FLIGHT = "11111111-1111-4111-8111-111111111111";
const SUPPLIER = "22222222-2222-4222-8222-222222222222";
const FUEL = "33333333-3333-4333-8333-333333333333";
const ORDER = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  vi.clearAllMocks();
  getFlight.mockResolvedValue({
    id: FLIGHT,
    origin: "PANC",
    scheduled_departure_at: "2026-09-27T16:00:00Z",
    aircraft: { tail_number: "N208PA" },
  });
  createFuelOrder.mockResolvedValue({});
  amendFuelOrder.mockResolvedValue({});
  cancelFuelOrder.mockResolvedValue({});
});

const order = (over = {}) => ({
  flightId: FLIGHT,
  source: "pilot" as const,
  supplierId: SUPPLIER,
  fuelTypeId: FUEL,
  gallons: 80,
  neededBy: "15:30",
  instructions: "north ramp",
  ...over,
});

describe("orderFuelForFlightAction", () => {
  it("orders for the flight's own tail, base and day, as whoever placed it", async () => {
    expect(await orderFuelForFlightAction(order())).toEqual({ ok: true });
    expect(createFuelOrder).toHaveBeenCalledWith({
      n_number: "N208PA",
      base_code: "PANC",
      supplier_id: SUPPLIER,
      fuel_type_id: FUEL,
      requested_quantity_gallons: 80,
      requested_fuel_date: "2026-09-27",
      requested_fuel_time: "2026-09-27T15:30:00Z",
      special_instructions: "north ramp",
      flight_id: FLIGHT,
      source: "pilot",
    });
    // Both screens that show the flight's fuel, and the Fuel page.
    expect(revalidatePath).toHaveBeenCalledWith("/dispatch");
    expect(revalidatePath).toHaveBeenCalledWith(`/flight-crew/preflight/${FLIGHT}`);
  });

  it("sends no time when none was given", async () => {
    await orderFuelForFlightAction(order({ neededBy: "" }));
    expect(createFuelOrder.mock.calls[0][0].requested_fuel_time).toBeNull();
  });

  it.each([
    [{ gallons: 0 }, "Enter the gallons."],
    [{ gallons: Number.NaN }, "Enter the gallons."],
    [{ neededBy: "3:30pm" }, "Needed-by is a 24-hour time."],
  ])("refuses %j before calling anything", async (over, message) => {
    expect(await orderFuelForFlightAction(order(over))).toEqual({ ok: false, error: message });
    expect(createFuelOrder).not.toHaveBeenCalled();
  });

  it("names an inactive supplier", async () => {
    createFuelOrder.mockRejectedValue(
      new TestApiError(409, "/x", '{"detail":"supplier is inactive — pick another supplier"}'),
    );
    expect(await orderFuelForFlightAction(order())).toEqual({
      ok: false,
      error: "That supplier is inactive — pick another.",
    });
  });
});

describe("amendFuelOrderAction", () => {
  it("changes the amount, with the reason and who changed it", async () => {
    expect(
      await amendFuelOrderAction({
        flightId: FLIGHT,
        orderId: ORDER,
        source: "pilot",
        gallons: 120,
        note: "extra for weather",
      }),
    ).toEqual({ ok: true });
    expect(amendFuelOrder).toHaveBeenCalledWith(ORDER, {
      requested_quantity_gallons: 120,
      note: "extra for weather",
      source: "pilot",
    });
  });

  it("says when the order has moved on", async () => {
    amendFuelOrder.mockRejectedValue(new TestApiError(409, "/x", '{"detail":"cannot amend"}'));
    const result = await amendFuelOrderAction({
      flightId: FLIGHT,
      orderId: ORDER,
      source: "dispatch",
      gallons: 120,
    });
    expect(result).toEqual({
      ok: false,
      error: "Couldn't change the order: the order has already been fueled or cancelled.",
    });
  });
});

describe("cancelFuelOrderAction", () => {
  it("needs a reason", async () => {
    expect(
      await cancelFuelOrderAction({ flightId: FLIGHT, orderId: ORDER, source: "pilot", reason: " " }),
    ).toEqual({ ok: false, error: "Say why it is cancelled." });
    expect(cancelFuelOrder).not.toHaveBeenCalled();
  });

  it("cancels as whoever asked", async () => {
    await cancelFuelOrderAction({
      flightId: FLIGHT,
      orderId: ORDER,
      source: "pilot",
      reason: "Flight cancelled",
    });
    expect(cancelFuelOrder).toHaveBeenCalledWith(ORDER, "Flight cancelled", "pilot");
  });
});
