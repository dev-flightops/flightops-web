import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, createFlight, redirectSpy } = vi.hoisted(() => {
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
    createFlight: vi.fn(),
    redirectSpy: vi.fn((_url: string) => {
      // Match Next.js behavior: redirect() throws a special error
      // (NEXT_REDIRECT) the framework catches. Throw a tagged error
      // so tests can detect a successful redirect without false-
      // positively matching other errors.
      const err = new Error("NEXT_REDIRECT");
      (err as Error & { __redirect?: true }).__redirect = true;
      throw err;
    }),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({ createFlight }));
vi.mock("next/navigation", () => ({ redirect: redirectSpy }));

import { createFlightAction } from "./actions";

beforeEach(() => {
  createFlight.mockReset();
  redirectSpy.mockClear();
});

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    flight_number: "GV404",
    aircraft_id: "11111111-1111-1111-1111-111111111111",
    origin: "padu",
    destination: "panc",
    scheduled_departure_at: "2026-07-01T14:00",
    scheduled_arrival_at: "2026-07-01T16:00",
    pax_count: "4",
    cargo_lbs: "200",
    notes: "demo",
    ...overrides,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

describe("createFlightAction", () => {
  it("calls createFlight with normalized ICAOs + UTC ISO times, then redirects", async () => {
    createFlight.mockReset().mockResolvedValueOnce({});
    redirectSpy.mockClear();

    await expect(
      createFlightAction({ status: "idle" }, makeFormData()),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(createFlight).toHaveBeenCalledTimes(1);
    const arg = createFlight.mock.calls[0][0];
    expect(arg.flight_number).toBe("GV404");
    expect(arg.origin).toBe("PADU");
    expect(arg.destination).toBe("PANC");
    expect(arg.scheduled_departure_at).toBe("2026-07-01T14:00:00.000Z");
    expect(arg.scheduled_arrival_at).toBe("2026-07-01T16:00:00.000Z");
    expect(arg.pax_count).toBe(4);
    expect(arg.cargo_lbs).toBe(200);
    expect(redirectSpy).toHaveBeenCalledWith("/flight-following");
  });

  it("returns field errors for missing required fields", async () => {
    const fd = makeFormData({ flight_number: "" });
    const result = await createFlightAction({ status: "idle" }, fd);

    expect(result.status).toBe("field-errors");
    if (result.status === "field-errors") {
      expect(result.errors.flight_number).toBeDefined();
    }
    expect(createFlight).not.toHaveBeenCalled();
  });

  it("rejects an arrival earlier than departure", async () => {
    const fd = makeFormData({
      scheduled_departure_at: "2026-07-01T16:00",
      scheduled_arrival_at: "2026-07-01T14:00",
    });
    const result = await createFlightAction({ status: "idle" }, fd);

    expect(result.status).toBe("field-errors");
    if (result.status === "field-errors") {
      expect(result.errors.scheduled_arrival_at).toMatch(/after departure/i);
    }
  });

  it("rejects malformed ICAOs", async () => {
    const fd = makeFormData({ origin: "x" });
    const result = await createFlightAction({ status: "idle" }, fd);

    expect(result.status).toBe("field-errors");
  });

  it("maps backend aircraft_not_active to a Maintenance hint", async () => {
    createFlight.mockReset().mockRejectedValueOnce(
      new TestApiError(
        409,
        "/ops/flights",
        JSON.stringify({ detail: "aircraft_not_active" }),
      ),
    );

    const result = await createFlightAction({ status: "idle" }, makeFormData());

    expect(result.status).toBe("api-error");
    if (result.status === "api-error") {
      expect(result.message).toMatch(/inactive/i);
      expect(result.message).toMatch(/maintenance/i);
    }
  });

  it("maps backend flight_number_conflict to a uniqueness hint", async () => {
    createFlight.mockReset().mockRejectedValueOnce(
      new TestApiError(
        409,
        "/ops/flights",
        JSON.stringify({ detail: "flight_number_conflict" }),
      ),
    );

    const result = await createFlightAction({ status: "idle" }, makeFormData());

    expect(result.status).toBe("api-error");
    if (result.status === "api-error") {
      expect(result.message).toMatch(/already uses this flight number/i);
    }
  });

  it("maps backend arrival_must_be_after_departure to a field error", async () => {
    createFlight.mockReset().mockRejectedValueOnce(
      new TestApiError(
        422,
        "/ops/flights",
        JSON.stringify({ detail: "arrival_must_be_after_departure" }),
      ),
    );

    const result = await createFlightAction({ status: "idle" }, makeFormData());

    expect(result.status).toBe("field-errors");
    if (result.status === "field-errors") {
      expect(result.errors.scheduled_arrival_at).toMatch(/after departure/i);
    }
  });

  it("maps 401 to the session-expired message", async () => {
    createFlight.mockReset().mockRejectedValueOnce(
      new TestApiError(401, "/ops/flights", "Unauthorized"),
    );

    const result = await createFlightAction({ status: "idle" }, makeFormData());

    expect(result.status).toBe("api-error");
    if (result.status === "api-error") {
      expect(result.message).toMatch(/session expired/i);
    }
  });
});

/**
 * A failed submit has to hand the values back.
 *
 * Client bug report 9/17: "all the data drops from whatever you are
 * inputting and you need to reenter it all. It should just give you a
 * notice that a field is wrong."
 *
 * The notice was already there; the data loss was React resetting an
 * uncontrolled form once its action resolved. Nothing in the returned
 * state could seed a defaultValue, so one mistyped ICAO cost the whole
 * form. These assert the echo exists on both failure shapes — without
 * it the form has nothing to restore from.
 */
describe("createFlightAction returns what was submitted", () => {
  function formOf(overrides: Record<string, string> = {}): FormData {
    const fd = new FormData();
    const base: Record<string, string> = {
      flight_number: "TEST999",
      aircraft_id: "11111111-1111-1111-1111-111111111111",
      origin: "PANC",
      destination: "PABE",
      scheduled_departure_at: "2026-10-01T18:00",
      scheduled_arrival_at: "2026-10-01T20:30",
      pax_count: "3",
      cargo_lbs: "250",
      notes: "Typed this out once and would rather not again.",
      ...overrides,
    };
    for (const [k, v] of Object.entries(base)) fd.set(k, v);
    return fd;
  }

  it("echoes every field back on a validation failure", async () => {
    // Origin too short — trips the schema, not the API.
    const state = await createFlightAction(
      { status: "idle" },
      formOf({ origin: "PA" }),
    );

    expect(state.status).toBe("field-errors");
    if (state.status === "idle") throw new Error("expected a failure");
    expect(state.values.flight_number).toBe("TEST999");
    expect(state.values.destination).toBe("PABE");
    expect(state.values.scheduled_departure_at).toBe("2026-10-01T18:00");
    expect(state.values.pax_count).toBe("3");
    expect(state.values.cargo_lbs).toBe("250");
    expect(state.values.notes).toContain("Typed this out once");
    // The select is the field that reads as "nothing was picked" when
    // it is lost, so it matters most that it comes back.
    expect(state.values.aircraft_id).toBe(
      "11111111-1111-1111-1111-111111111111",
    );
  });

  it("does not echo React's internal action fields", async () => {
    const fd = formOf({ origin: "PA" });
    fd.set("$ACTION_ID_abc", "internal");
    const state = await createFlightAction({ status: "idle" }, fd);
    if (state.status === "idle") throw new Error("expected a failure");
    expect(Object.keys(state.values).some((k) => k.startsWith("$ACTION"))).toBe(
      false,
    );
  });
});
