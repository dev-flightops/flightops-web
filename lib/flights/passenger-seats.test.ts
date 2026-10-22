import { describe, expect, it, vi } from "vitest";

const { ApiError } = vi.hoisted(() => ({
  ApiError: class extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock("@/lib/api/client", () => ({ ApiError }));

import { passengerSeatsRefusal } from "./passenger-seats";

const seats = (detail: unknown, status = 409) =>
  new ApiError(status, "/ops/flights", JSON.stringify({ detail }));

describe("passengerSeatsRefusal (#107)", () => {
  it("says how many seats there are and where a tenth person goes", () => {
    expect(
      passengerSeatsRefusal(
        seats({ error: "more_passengers_than_seats", tail_number: "N503PA", seats: 9, passengers: 10 }),
      ),
    ).toBe(
      "N503PA has 9 passenger seats, and this would make 10 passengers. Someone in the " +
        "co-pilot seat must be a company check airman, entered as crew.",
    );
  });

  it("leaves every other error to its caller", () => {
    expect(passengerSeatsRefusal(seats("manifest is locked"))).toBeNull();
    expect(passengerSeatsRefusal(seats({ error: "flight_full" }))).toBeNull();
    expect(passengerSeatsRefusal(seats({ error: "more_passengers_than_seats" }, 422))).toBeNull();
    expect(passengerSeatsRefusal(new ApiError(409, "/x", "not json"))).toBeNull();
    expect(passengerSeatsRefusal(new Error("boom"))).toBeNull();
  });
});
