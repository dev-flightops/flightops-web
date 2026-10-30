import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, createBooking, createCustomer, loadZoneTable } = vi.hoisted(() => {
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
    createBooking: vi.fn(async () => ({ id: "b-1" })),
    createCustomer: vi.fn(async () => ({ id: "22222222-2222-4222-8222-222222222222" })),
    loadZoneTable: vi.fn(async () => ({
      byIcao: { PANC: "America/Anchorage", PABE: "America/Anchorage" },
      fallback: "America/Anchorage",
    })),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/reservations", () => ({ createBooking, createCustomer }));
vi.mock("@/lib/api/auth", () => ({ loadZoneTable }));
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

describe("the requested departure", () => {
  it("is local at the departure base, saved in UTC (#68)", async () => {
    // The form says "Local time"; read in the server's zone, which on
    // Vercel is UTC, a 09:00 booking was saved as 09:00Z, 01:00 local.
    await submit({ requested_departure_at_local: "2026-09-20T09:00" });
    expect(createBooking).toHaveBeenCalledWith(
      expect.objectContaining({ requested_departure_at: "2026-09-20T17:00:00Z" }),
    );
  });
});

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


describe("who it's for, and the flight (#137)", () => {
  const FLIGHT = "33333333-3333-4333-8333-333333333333";

  function withPassengers(fd: FormData, rows: string[][]): FormData {
    for (const [first, last, weight, notes] of rows) {
      fd.append("passenger_first_name", first);
      fd.append("passenger_last_name", last);
      fd.append("passenger_weight_lbs", weight);
      fd.append("passenger_notes", notes);
    }
    return fd;
  }

  beforeEach(() => {
    createBooking.mockClear();
    createCustomer.mockClear();
  });

  it("names the passengers and puts it on the flight it was opened with", async () => {
    const fd = withPassengers(form({ flight_id: FLIGHT }), [
      ["Phil", "Bass", "190", "Wheelchair assist"],
      ["", "", "", ""],
    ]);
    await expect(createBookingAction({ status: "idle" }, fd)).rejects.toThrow(
      "REDIRECT:/reservations/bookings/b-1?filed=1",
    );
    expect(createBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_id: CUSTOMER,
        flight_id: FLIGHT,
        pax_count: 1,
        passengers: [{ first_name: "Phil", last_name: "Bass", weight_lbs: 190, notes: "Wheelchair assist" }],
      }),
    );
  });

  it("adds a caller who isn't on file as a customer", async () => {
    const fd = withPassengers(form({ customer_id: "", new_customer_name: "Phil Bass" }), [["Phil", "Bass", "", ""]]);
    await expect(createBookingAction({ status: "idle" }, fd)).rejects.toThrow("REDIRECT:");
    expect(createCustomer).toHaveBeenCalledWith({ full_name: "Phil Bass" });
    expect(createBooking).toHaveBeenCalledWith(
      expect.objectContaining({ customer_id: "22222222-2222-4222-8222-222222222222" }),
    );
  });

  it("asks for a customer when there's neither one picked nor a name", async () => {
    const result = await createBookingAction({ status: "idle" }, form({ customer_id: "", new_customer_name: "" }));
    expect(result.fieldErrors?.customer_id).toBe("Pick a customer, or type a new customer's name.");
    expect(createBooking).not.toHaveBeenCalled();
  });

  it("goes back where it was started, never to another site", async () => {
    await expect(
      createBookingAction({ status: "idle" }, form({ return_to: `/manifest/${FLIGHT}` })),
    ).rejects.toThrow(`REDIRECT:/manifest/${FLIGHT}`);
    await expect(
      createBookingAction({ status: "idle" }, form({ return_to: "//evil.example/x" })),
    ).rejects.toThrow("REDIRECT:/reservations/bookings/b-1?filed=1");
  });

  it("says how many seats a full flight has left", async () => {
    createBooking.mockRejectedValueOnce(
      new TestApiError(
        409,
        "/reservations/bookings",
        '{"detail":{"error":"flight_full","seats_total":9,"seats_booked":8,"seats_available":1,"seats_requested":2}}',
      ),
    );
    const result = await createBookingAction({ status: "idle" }, form({ flight_id: FLIGHT }));
    expect(result.message).toBe("That flight has 1 seat left on the legs this booking rides; it needs 2.");
  });
});


describe("a return trip (#148)", () => {
  beforeEach(() => createBooking.mockClear());

  it("files the way back with the way out, local at its own origin", async () => {
    const result = await submit({
      return_departure_at_local: "2026-09-22T15:00",
      return_flight_id: "33333333-3333-4333-8333-333333333333",
    });
    expect(result.status).toBe("ok");
    expect(createBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        origin_icao: "PANC",
        destination_icao: "PABE",
        return_trip: {
          // 15:00 AKDT at PABE.
          requested_departure_at: "2026-09-22T23:00:00Z",
          flight_id: "33333333-3333-4333-8333-333333333333",
        },
      }),
    );
  });

  it("is one way without a return time", async () => {
    await submit();
    expect(createBooking).toHaveBeenCalledWith(expect.objectContaining({ return_trip: null }));
  });
});
