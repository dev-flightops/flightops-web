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

import { flownFlightsOnAction, raiseInvoicesAction } from "./raise-actions";

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

describe("flownFlightsOnAction (R1)", () => {
  it("lists the day's flown flights, newest first", async () => {
    // ops-service lists a day oldest first.
    listFlights.mockResolvedValue({ items: [item(7), item(8), item(9)], total: 3 });

    const state = await flownFlightsOnAction("2026-09-08");

    expect(listFlights).toHaveBeenCalledWith({
      status: "completed",
      onDate: "2026-09-08",
      limit: 200,
    });
    expect(state).toEqual({
      status: "ok",
      flights: [
        expect.objectContaining({ id: "f-9" }),
        expect.objectContaining({ id: "f-8" }),
        expect.objectContaining({ id: "f-7" }),
      ],
      truncated: false,
    });
  });

  it("reaches any day, not only the last few dozen flights", async () => {
    // The old picker offered the 50 most recent: about a week.
    listFlights.mockResolvedValue({ items: [item(3)], total: 1 });
    await flownFlightsOnAction("2025-11-03");
    expect(listFlights).toHaveBeenCalledWith(
      expect.objectContaining({ onDate: "2025-11-03" }),
    );
  });

  it("says when more flew that day than one list holds", async () => {
    listFlights.mockResolvedValue({ items: [item(1), item(2)], total: 201 });
    const state = await flownFlightsOnAction("2026-09-08");
    expect(state.status === "ok" && state.truncated).toBe(true);
  });

  it("refuses anything that is not a date, before ops-service", async () => {
    for (const bad of ["", "2026-02-30", "08/09/2026", "2026-09-08&status=scheduled"]) {
      expect(await flownFlightsOnAction(bad)).toEqual({
        status: "error",
        message: "Choose the date the flight flew.",
      });
    }
    expect(listFlights).not.toHaveBeenCalled();
  });

  it("says so when the flights cannot be loaded", async () => {
    listFlights.mockRejectedValue(new TestApiError(503, "/ops/flights", "down"));
    expect(await flownFlightsOnAction("2026-09-08")).toEqual({
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
