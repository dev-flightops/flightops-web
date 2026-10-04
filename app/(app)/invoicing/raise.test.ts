import { describe, expect, it, vi } from "vitest";

const { ApiError, SessionExpiredError } = vi.hoisted(() => {
  class ApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  class SessionExpiredError extends ApiError {
    constructor(path: string, message: string) {
      super(401, path, message);
    }
  }
  return { ApiError, SessionExpiredError };
});
// The real module reads the session through @/auth; these tests only
// need its two error classes.
vi.mock("@/lib/api/client", () => ({ ApiError, SessionExpiredError }));

import type { GenerateResult } from "@/lib/api/customer-invoices";
import type { FlightListItem } from "@/lib/api/types";

import { explainRaiseError, flownFlightOption, raisedFrom } from "./raise";

/**
 * What the Raise invoices panel says: how a flight reads in the picker,
 * what the result lists, and what a refusal says.
 */

function flight(over: Partial<FlightListItem> = {}): FlightListItem {
  return {
    id: "f-1",
    flight_number: "PGR733",
    origin: "PANC",
    destination: "PAOM",
    scheduled_departure_at: "2026-09-28T16:00:00Z",
    scheduled_arrival_at: "2026-09-28T18:00:00Z",
    status: "completed",
    aircraft: {
      id: "a-1",
      tail_number: "N733RX",
      model: "Cessna 208 Caravan",
      seats: 9,
    },
    ...over,
  } as FlightListItem;
}

describe("flownFlightOption", () => {
  it("reads as number, route, Zulu departure and tail", () => {
    expect(flownFlightOption(flight())).toEqual({
      id: "f-1",
      label: "PGR733 · PANC → PAOM · Sep 28, 16:00z · N733RX",
    });
  });

  it("keeps the UTC day, as the board shows it", () => {
    // 01:30z on the 29th is the evening of the 28th in Alaska; the
    // picker says the same day the rest of the app says.
    expect(
      flownFlightOption(flight({ scheduled_departure_at: "2026-09-29T01:30:00Z" })).label,
    ).toBe("PGR733 · PANC → PAOM · Sep 29, 01:30z · N733RX");
  });
});

describe("raisedFrom", () => {
  it("lists what was created and who was skipped, with the reasons", () => {
    const result: GenerateResult = {
      invoices: [
        {
          id: "inv-1",
          invoice_number: "INV-000001",
          customer: { id: "c-1", full_name: "A <b>&</b> Co" },
          total_cents: 134_139,
          has_unpriced_lines: false,
        },
      ] as GenerateResult["invoices"],
      skipped: [
        {
          booking_id: "b-2",
          reason: "customer already has INV-000002 for this flight; a booking added after INV-000002 was raised is not on it: void INV-000002 and raise again to include it",
          customer: { id: "c-2", full_name: "Bob Kalskag" },
        },
        { booking_id: "b-3", reason: "cancelled", customer: null },
      ],
      notes: ["Cargo (100.0 lb) is billed on INV-000001 to A <b>&</b> Co, the first customer booked on this flight."],
    };
    expect(raisedFrom(result)).toEqual({
      status: "ok",
      created: [
        {
          id: "inv-1",
          invoiceNumber: "INV-000001",
          customer: "A <b>&</b> Co",
          totalCents: 134_139,
          hasUnpricedLines: false,
        },
      ],
      skipped: [
        { customer: "Bob Kalskag", reason: "customer already has INV-000002 for this flight; a booking added after INV-000002 was raised is not on it: void INV-000002 and raise again to include it" },
        { customer: "A deleted customer", reason: "cancelled" },
      ],
      notes: result.notes,
    });
  });
});

describe("explainRaiseError", () => {
  it("says another raise is running, in words", () => {
    expect(
      explainRaiseError(
        new ApiError(
          409,
          "/billing/customer-invoices/generate",
          '{"detail":"invoice_generation_in_progress"}',
        ),
      ),
    ).toBe(
      "This flight's invoices are being raised right now, in another tab or by someone else. Wait a moment, then check the list below.",
    );
  });

  it("says a flight that has not flown has nothing to invoice", () => {
    expect(
      explainRaiseError(
        new ApiError(409, "/x", '{"detail":"flight_has_not_flown"}'),
      ),
    ).toBe("That flight has not flown yet, so there is nothing to invoice.");
  });

  it("names the roles on a 403", () => {
    expect(explainRaiseError(new ApiError(403, "/x", "insufficient_role"))).toBe(
      "Raising invoices is limited to executive admins and the director of operations.",
    );
  });

  it("sends an expired session to sign in", () => {
    expect(explainRaiseError(new SessionExpiredError("/x", "expired"))).toBe(
      "Your session has expired. Sign in again.",
    );
  });

  it("does not paste raw JSON at the user", () => {
    expect(explainRaiseError(new ApiError(500, "/x", '{"detail":"boom"}'))).toBe(
      "Could not raise the invoices (HTTP 500).",
    );
    expect(explainRaiseError(new TypeError("fetch failed"))).toBe(
      "Could not reach billing-service.",
    );
  });
});
