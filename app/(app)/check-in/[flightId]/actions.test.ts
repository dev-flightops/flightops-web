import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, addPax, getCheckIn } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, addPax: vi.fn(), getCheckIn: vi.fn() };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError, SessionExpiredError: class extends Error {} }));
vi.mock("@/lib/api/manifest", () => ({ addPax }));
vi.mock("@/lib/api/check-in", () => ({ getCheckIn }));

import { addWalkUpAction } from "./actions";

const WALK_UP = { first_name: "Wally", last_name: "Walkup", weight_lbs: 170, baggage_lbs: 10 };

describe("addWalkUpAction: the aircraft's passenger seats (#107)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("says the seats are full, not that the manifest is locked", async () => {
    addPax.mockRejectedValue(
      new TestApiError(
        409,
        "/manifest/flights/f-1/pax",
        JSON.stringify({
          detail: { error: "more_passengers_than_seats", tail_number: "N503PA", seats: 9, passengers: 10 },
        }),
      ),
    );
    const result = await addWalkUpAction("f-1", WALK_UP);
    expect(result).toEqual({
      ok: false,
      error:
        "N503PA has 9 passenger seats, and this would make 10 passengers. Someone in the co-pilot seat must be a company check airman, entered as crew.",
    });
    expect(getCheckIn).not.toHaveBeenCalled();
  });

  it("still says so when the manifest is locked", async () => {
    addPax.mockRejectedValue(
      new TestApiError(409, "/manifest/flights/f-1/pax", JSON.stringify({ detail: "manifest is locked; unlock is not implemented" })),
    );
    expect(await addWalkUpAction("f-1", WALK_UP)).toEqual({
      ok: false,
      error: "The manifest is locked, so no one can be added.",
    });
  });
});
