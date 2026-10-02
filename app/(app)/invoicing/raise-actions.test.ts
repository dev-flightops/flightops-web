import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, generateCustomerInvoices, listFlights, revalidatePath } =
  vi.hoisted(() => {
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
      generateCustomerInvoices: vi.fn(),
      listFlights: vi.fn(),
      revalidatePath: vi.fn(),
    };
  });
vi.mock("@/lib/api/client", () => ({
  ApiError: TestApiError,
  SessionExpiredError: class extends TestApiError {},
}));
vi.mock("@/lib/api/customer-invoices", () => ({ generateCustomerInvoices }));
vi.mock("@/lib/api/ops", () => ({ listFlights }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { raiseInvoicesAction, recentFlownFlightsAction } from "./raise-actions";

const FLIGHT = "6f1c2a4e-0b7d-4c55-9a51-3f2a7c9d1e20";

function item(n: number) {
  return {
    id: `f-${n}`,
    flight_number: `PGR${n}`,
    origin: "PANC",
    destination: "PAOM",
    scheduled_departure_at: `2026-09-${String(n).padStart(2, "0")}T16:00:00Z`,
    scheduled_arrival_at: `2026-09-${String(n).padStart(2, "0")}T18:00:00Z`,
    status: "completed",
    aircraft: { id: "a", tail_number: "N733RX", model: "C208", seats: 9 },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("recentFlownFlightsAction", () => {
  it("asks for the last page of flown flights and lists them newest first", async () => {
    // ops-service lists oldest first: the count, then the last page.
    listFlights
      .mockResolvedValueOnce({ items: [item(1)], total: 120 })
      .mockResolvedValueOnce({ items: [item(7), item(8), item(9)], total: 120 });

    const state = await recentFlownFlightsAction();

    expect(listFlights).toHaveBeenNthCalledWith(1, { status: "completed", limit: 1 });
    expect(listFlights).toHaveBeenNthCalledWith(2, {
      status: "completed",
      limit: 50,
      offset: 70,
    });
    expect(state.status).toBe("ok");
    if (state.status === "ok") {
      expect(state.flights.map((f) => f.id)).toEqual(["f-9", "f-8", "f-7"]);
    }
  });

  it("starts at the first flight when there are fewer than fifty", async () => {
    listFlights
      .mockResolvedValueOnce({ items: [], total: 3 })
      .mockResolvedValueOnce({ items: [item(1), item(2), item(3)], total: 3 });
    await recentFlownFlightsAction();
    expect(listFlights).toHaveBeenLastCalledWith({
      status: "completed",
      limit: 50,
      offset: 0,
    });
  });

  it("says so when the flights cannot be loaded", async () => {
    listFlights.mockRejectedValue(new TestApiError(503, "/ops/flights", "down"));
    expect(await recentFlownFlightsAction()).toEqual({
      status: "error",
      message: "Could not load the flown flights (HTTP 503).",
    });
  });
});

describe("raiseInvoicesAction", () => {
  it("raises the flight's invoices and refreshes the list", async () => {
    generateCustomerInvoices.mockResolvedValue({
      invoices: [],
      skipped: [],
      notes: [],
    });
    const state = await raiseInvoicesAction(FLIGHT);
    expect(generateCustomerInvoices).toHaveBeenCalledWith(FLIGHT);
    expect(revalidatePath).toHaveBeenCalledWith("/invoicing");
    expect(state).toEqual({ status: "ok", created: [], skipped: [], notes: [] });
  });

  it("refuses anything that is not a flight id, before the service", async () => {
    for (const bad of ["", "../../admin", `${FLIGHT}&flight_id=x`]) {
      expect(await raiseInvoicesAction(bad)).toEqual({
        status: "error",
        message: "Choose a flown flight.",
      });
    }
    expect(generateCustomerInvoices).not.toHaveBeenCalled();
  });

  it("explains a raise already running instead of failing", async () => {
    generateCustomerInvoices.mockRejectedValue(
      new TestApiError(
        409,
        "/billing/customer-invoices/generate",
        '{"detail":"invoice_generation_in_progress"}',
      ),
    );
    const state = await raiseInvoicesAction(FLIGHT);
    expect(state).toEqual({
      status: "error",
      message:
        "This flight's invoices are being raised right now, in another tab or by someone else. Wait a moment, then check the list below.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
