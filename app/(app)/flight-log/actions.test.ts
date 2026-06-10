import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, createFlightLog, redirectSpy } = vi.hoisted(() => {
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
    createFlightLog: vi.fn(),
    redirectSpy: vi.fn((_url: string) => {
      // Next's redirect() throws NEXT_REDIRECT internally.
      const err = new Error("NEXT_REDIRECT");
      throw err;
    }),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({ createFlightLog }));
vi.mock("next/navigation", () => ({ redirect: redirectSpy }));

import { createFlightLogAction } from "./actions";

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    aircraft_id: "11111111-1111-1111-1111-111111111111",
    flight_type: "advisory",
    ...overrides,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  createFlightLog.mockReset();
  redirectSpy.mockClear();
});

describe("createFlightLogAction", () => {
  it("creates the log and redirects to /flight-log/{id} on success", async () => {
    createFlightLog.mockResolvedValueOnce({ id: "log-42" });

    await expect(
      createFlightLogAction({ status: "idle" }, makeFormData()),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(createFlightLog).toHaveBeenCalledWith({
      aircraft_id: "11111111-1111-1111-1111-111111111111",
      flight_id: null,
      flight_number: null,
      flight_type: "advisory",
    });
    expect(redirectSpy).toHaveBeenCalledWith("/flight-log/log-42");
  });

  it("forwards optional flight_id + flight_number when supplied", async () => {
    createFlightLog.mockResolvedValueOnce({ id: "log-1" });

    await expect(
      createFlightLogAction(
        { status: "idle" },
        makeFormData({
          flight_id: "22222222-2222-2222-2222-222222222222",
          flight_number: "GV101",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(createFlightLog).toHaveBeenCalledWith(
      expect.objectContaining({
        flight_id: "22222222-2222-2222-2222-222222222222",
        flight_number: "GV101",
      }),
    );
  });

  it("returns field errors when aircraft_id isn't a UUID", async () => {
    const result = await createFlightLogAction(
      { status: "idle" },
      makeFormData({ aircraft_id: "not-a-uuid" }),
    );

    expect(result.status).toBe("field-errors");
    if (result.status === "field-errors") {
      expect(result.errors.aircraft_id).toBeDefined();
    }
    expect(createFlightLog).not.toHaveBeenCalled();
  });

  it("returns field errors when flight_type is invalid", async () => {
    const result = await createFlightLogAction(
      { status: "idle" },
      makeFormData({ flight_type: "joyride" }),
    );

    expect(result.status).toBe("field-errors");
  });

  it("maps aircraft_not_active to a Maintenance hint", async () => {
    createFlightLog.mockRejectedValueOnce(
      new TestApiError(
        409,
        "/ops/flight-logs",
        JSON.stringify({ detail: "aircraft_not_active" }),
      ),
    );

    const result = await createFlightLogAction(
      { status: "idle" },
      makeFormData(),
    );

    expect(result.status).toBe("api-error");
    if (result.status === "api-error") {
      expect(result.message).toMatch(/inactive/i);
    }
  });

  it("maps flight_aircraft_mismatch to a field error on the flight picker", async () => {
    createFlightLog.mockRejectedValueOnce(
      new TestApiError(
        400,
        "/ops/flight-logs",
        JSON.stringify({ detail: "flight_aircraft_mismatch" }),
      ),
    );

    const result = await createFlightLogAction(
      { status: "idle" },
      makeFormData({
        flight_id: "22222222-2222-2222-2222-222222222222",
      }),
    );

    expect(result.status).toBe("field-errors");
    if (result.status === "field-errors") {
      expect(result.errors.flight_id).toMatch(/belongs to the selected aircraft/i);
    }
  });

  it("maps 401 to the session-expired message", async () => {
    createFlightLog.mockRejectedValueOnce(
      new TestApiError(401, "/ops/flight-logs", "Unauthorized"),
    );

    const result = await createFlightLogAction(
      { status: "idle" },
      makeFormData(),
    );

    expect(result.status).toBe("api-error");
    if (result.status === "api-error") {
      expect(result.message).toMatch(/session expired/i);
    }
  });
});
