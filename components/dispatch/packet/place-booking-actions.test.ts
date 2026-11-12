import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, assignBookingToFlight: vi.fn(), revalidatePath: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: api.TestApiError }));
vi.mock("@/lib/api/reservations", () => ({ assignBookingToFlight: api.assignBookingToFlight }));
vi.mock("next/cache", () => ({ revalidatePath: api.revalidatePath }));

import { placeBookingAction } from "./place-booking-actions";

const BOOKING = "6b0f6a3e-2c1d-4e5f-8a9b-0c1d2e3f4a5b";
const FLIGHT = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

beforeEach(() => vi.clearAllMocks());

describe("placing a waiting booking (LOG-05)", () => {
  it("puts it on the flight through reservations and refreshes dispatch", async () => {
    api.assignBookingToFlight.mockResolvedValue({});
    expect(await placeBookingAction(BOOKING, FLIGHT)).toEqual({ ok: true });
    expect(api.assignBookingToFlight).toHaveBeenCalledWith(BOOKING, FLIGHT);
    expect(api.revalidatePath).toHaveBeenCalledWith("/dispatch");
  });

  it("says when it no longer fits", async () => {
    api.assignBookingToFlight.mockRejectedValue(new api.TestApiError(409, "/x", "{}"));
    expect(await placeBookingAction(BOOKING, FLIGHT)).toEqual({ ok: false, message: "It doesn't fit any more: refresh the page." });
  });

  it("refuses ids that aren't", async () => {
    expect((await placeBookingAction("x", FLIGHT)).ok).toBe(false);
    expect(api.assignBookingToFlight).not.toHaveBeenCalled();
  });
});
