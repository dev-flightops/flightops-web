import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The house and room edit actions.
 *
 * These exist because there was no way to change a house or a room
 * once created, though the service has always accepted the PATCHes.
 * What is worth pinning is the validation — which names the offending
 * field rather than letting a CHECK constraint surface as a database
 * error — and the blank-means-null handling, because "no nightly
 * rate" and "a rate of zero" are different claims and the cost report
 * treats them differently.
 */

const { updateHousingUnit, updateHousingRoom, revalidatePath, TestApiError } =
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
      updateHousingUnit: vi.fn(),
      updateHousingRoom: vi.fn(),
      revalidatePath: vi.fn(),
      TestApiError,
    };
  });

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/housing", () => ({
  updateHousingUnit,
  updateHousingRoom,
  addHousingRoom: vi.fn(),
  createHousingBooking: vi.fn(),
  createHousingUnit: vi.fn(),
  cancelHousingBooking: vi.fn(),
}));

import { updateHousingRoomAction, updateHousingUnitAction } from "./actions";

beforeEach(() => {
  updateHousingUnit.mockReset().mockResolvedValue({ id: "u1" });
  updateHousingRoom.mockReset().mockResolvedValue({ id: "r1" });
  revalidatePath.mockReset();
});

describe("editing a house", () => {
  it("saves the trimmed name and station", async () => {
    const r = await updateHousingUnitAction("u1", {
      name: "  Bethel Crew House  ",
      station: "  PABE  ",
    });
    expect(r.ok).toBe(true);
    expect(updateHousingUnit).toHaveBeenCalledWith("u1", {
      name: "Bethel Crew House",
      station: "PABE",
    });
  });

  it("refuses an empty name rather than saving a nameless house", async () => {
    const r = await updateHousingUnitAction("u1", { name: "   " });
    expect(r).toEqual({ ok: false, error: "House name is required." });
    expect(updateHousingUnit).not.toHaveBeenCalled();
  });

  it("refuses an empty station", async () => {
    const r = await updateHousingUnitAction("u1", { station: "" });
    expect(r.ok).toBe(false);
    expect(updateHousingUnit).not.toHaveBeenCalled();
  });

  it("clears an optional field when sent null", async () => {
    // Emptying the contact phone has to remove it. Ignoring the blank
    // would make the field impossible to unset.
    await updateHousingUnitAction("u1", { contact_phone: null });
    expect(updateHousingUnit).toHaveBeenCalledWith("u1", {
      contact_phone: null,
    });
  });

  it("leaves a field alone when it is not passed", async () => {
    await updateHousingUnitAction("u1", { name: "X" });
    const patch = updateHousingUnit.mock.calls[0][1];
    expect("notes" in patch).toBe(false);
    expect("station" in patch).toBe(false);
  });

  it("revalidates every page that shows the house", async () => {
    await updateHousingUnitAction("u1", { name: "X" });
    const paths = revalidatePath.mock.calls.map((c) => c[0]);
    // The calendar groups by unit and the reports page counts rooms
    // per unit, so a rename has to reach both.
    expect(paths).toEqual(
      expect.arrayContaining([
        "/housing/u1",
        "/housing",
        "/housing/calendar",
        "/housing/reports",
      ]),
    );
  });

  it("reports a refusal instead of throwing", async () => {
    updateHousingUnit.mockRejectedValueOnce(
      new TestApiError(403, "/housing/units/u1", "no"),
    );
    const r = await updateHousingUnitAction("u1", { name: "X" });
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });
});

describe("editing a room", () => {
  it("saves the fields it was given", async () => {
    const r = await updateHousingRoomAction("u1", "r1", {
      room_number: " 01 ",
      capacity: 2,
      status: "maintenance",
    });
    expect(r.ok).toBe(true);
    expect(updateHousingRoom).toHaveBeenCalledWith("r1", {
      room_number: "01",
      capacity: 2,
      status: "maintenance",
    });
  });

  it("refuses an empty room number", async () => {
    const r = await updateHousingRoomAction("u1", "r1", { room_number: " " });
    expect(r).toEqual({ ok: false, error: "Room number is required." });
    expect(updateHousingRoom).not.toHaveBeenCalled();
  });

  it.each([0, -1, Number.NaN])(
    "refuses a capacity of %s by name, not as a database error",
    async (capacity) => {
      const r = await updateHousingRoomAction("u1", "r1", { capacity });
      expect(r).toEqual({ ok: false, error: "Capacity must be at least 1." });
      expect(updateHousingRoom).not.toHaveBeenCalled();
    },
  );

  it("refuses a negative cost", async () => {
    const r = await updateHousingRoomAction("u1", "r1", {
      cost_per_night: "-5",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/positive number/i);
    expect(updateHousingRoom).not.toHaveBeenCalled();
  });

  it("refuses a cost that is not a number", async () => {
    const r = await updateHousingRoomAction("u1", "r1", {
      cost_per_night: "free",
    });
    expect(r.ok).toBe(false);
    expect(updateHousingRoom).not.toHaveBeenCalled();
  });

  it("turns a blank cost into no rate, not a rate of zero", async () => {
    // The cost report leaves an unpriced room out of the total and
    // says so. A zero would quietly report the room as free.
    const r = await updateHousingRoomAction("u1", "r1", {
      cost_per_night: "",
    });
    expect(r.ok).toBe(true);
    expect(updateHousingRoom).toHaveBeenCalledWith("r1", {
      cost_per_night: null,
    });
  });

  it("accepts a zero cost when that is what was typed", async () => {
    // Genuinely free company housing is a real thing; it is only the
    // BLANK field that means unknown.
    const r = await updateHousingRoomAction("u1", "r1", {
      cost_per_night: "0",
    });
    expect(r.ok).toBe(true);
    expect(updateHousingRoom).toHaveBeenCalledWith("r1", {
      cost_per_night: "0",
    });
  });

  it("keeps the cost as a string so a cent is not lost", async () => {
    await updateHousingRoomAction("u1", "r1", { cost_per_night: "85.50" });
    expect(updateHousingRoom.mock.calls[0][1].cost_per_night).toBe("85.50");
  });

  it("passes amenity toggles through, including turning one off", async () => {
    await updateHousingRoomAction("u1", "r1", {
      has_wifi: false,
      has_laundry: true,
    });
    expect(updateHousingRoom).toHaveBeenCalledWith("r1", {
      has_wifi: false,
      has_laundry: true,
    });
  });

  it("revalidates the reports page, whose totals depend on the rate", async () => {
    await updateHousingRoomAction("u1", "r1", { cost_per_night: "90" });
    expect(revalidatePath.mock.calls.map((c) => c[0])).toContain(
      "/housing/reports",
    );
  });

  it("reports a refusal instead of throwing", async () => {
    updateHousingRoom.mockRejectedValueOnce(
      new TestApiError(403, "/housing/rooms/r1", "no"),
    );
    const r = await updateHousingRoomAction("u1", "r1", { capacity: 2 });
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });
});
