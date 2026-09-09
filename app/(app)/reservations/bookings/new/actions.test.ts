import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, createBooking } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, createBooking: vi.fn(async () => ({ id: "b-1" })) };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/reservations", () => ({ createBooking }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { createBookingAction } from "./actions";

/**
 * Airport identifiers on a new booking.
 *
 * Origin and destination are what a booking is matched to a flight on,
 * so a booking filed against an airport that cannot exist can never be
 * put on one: it sits in the dispatch queue reading "no flights
 * scheduled on this route that day" for ever, and the fault reads as
 * dispatch being broken rather than as four characters nobody checked.
 * The field was `min(2).max(10)` with no shape, and one such booking
 * reached the live data.
 */

const CUSTOMER = "11111111-1111-4111-8111-111111111111";

function form(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const fields: Record<string, string> = {
    customer_id: CUSTOMER,
    origin_icao: "PANC",
    destination_icao: "PABE",
    requested_departure_at_local: "2026-09-20T09:00",
    pax_count: "2",
    ...over,
  };
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

async function submit(over: Record<string, string> = {}) {
  try {
    return await createBookingAction({ status: "idle" }, form(over));
  } catch (e) {
    // A successful create redirects, which the mock throws.
    return { status: "ok" as const, redirect: String(e) };
  }
}

beforeEach(() => createBooking.mockClear());

describe("a malformed identifier", () => {
  it.each(["PANC`", "PA", "PANCX", "PA-C", "P@NC", ""])(
    "is refused as an origin: %s",
    async (bad) => {
      const result = await submit({ origin_icao: bad });
      expect(result.status).toBe("error");
      expect(createBooking).not.toHaveBeenCalled();
    },
  );

  it("names the field rather than the rule", async () => {
    // "String should match pattern '^[A-Z0-9]{3,4}$'" is what the
    // server says. It is not what a reservations agent should read.
    const result = await submit({ origin_icao: "PANC`" });
    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.fieldErrors?.origin_icao).toMatch(
      /origin should be an airport code like PANC or A61/i,
    );
  });

  it("is refused as a destination too", async () => {
    const result = await submit({ destination_icao: "PABE`" });
    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.fieldErrors?.destination_icao).toMatch(
      /airport code/i,
    );
  });

  it("still says 'required' when the field is simply empty", async () => {
    const result = await submit({ origin_icao: "  " });
    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.fieldErrors?.origin_icao).toMatch(/origin required/i);
  });
});

describe("a real identifier", () => {
  it.each(["PANC", "A61", "5KE", "BET"])("is accepted: %s", async (good) => {
    // Three characters is the floor rather than four: plenty of the
    // strips this operation serves have no ICAO indicator and go by
    // their FAA designator, which can lead with a digit.
    createBooking.mockClear();
    await submit({ origin_icao: good });
    expect(createBooking).toHaveBeenCalledWith(
      expect.objectContaining({ origin_icao: good }),
    );
  });

  it("is trimmed and upper-cased before it is checked", async () => {
    // Somebody typing " panc " has typed an airport, not made a
    // mistake worth an error message.
    createBooking.mockClear();
    await submit({ origin_icao: "  panc  ", destination_icao: "pabe" });
    expect(createBooking).toHaveBeenCalledWith(
      expect.objectContaining({ origin_icao: "PANC", destination_icao: "PABE" }),
    );
  });
});
