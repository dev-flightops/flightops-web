import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, createWeatherBriefing, redirectSpy } = vi.hoisted(() => {
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
    createWeatherBriefing: vi.fn(),
    redirectSpy: vi.fn((_url: string) => {
      const err = new Error("NEXT_REDIRECT");
      throw err;
    }),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/weather", () => ({ createWeatherBriefing }));
vi.mock("next/navigation", () => ({ redirect: redirectSpy }));

import { createBriefingAction } from "./actions";

function fd(fields: Record<string, string> = {}): FormData {
  const f = new FormData();
  const base: Record<string, string> = { airports_raw: "PANC PAEN", ...fields };
  for (const [k, v] of Object.entries(base)) f.set(k, v);
  return f;
}

beforeEach(() => {
  createWeatherBriefing.mockReset();
  redirectSpy.mockClear();
});

describe("createBriefingAction", () => {
  it("parses the free-form ICAO string + creates the briefing + redirects", async () => {
    createWeatherBriefing.mockResolvedValueOnce({ id: "brief-42" });

    await expect(
      createBriefingAction({ status: "idle" }, fd({ airports_raw: "panc, paen" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(createWeatherBriefing).toHaveBeenCalledWith({
      airports: ["PANC", "PAEN"],
      flight_id: null,
      aircraft_id: null,
      dispatcher_notes: null,
    });
    expect(redirectSpy).toHaveBeenCalledWith("/weather/brief-42");
  });

  it("forwards flight_id, aircraft_id, dispatcher_notes when supplied", async () => {
    createWeatherBriefing.mockResolvedValueOnce({ id: "brief-1" });

    await expect(
      createBriefingAction(
        { status: "idle" },
        fd({
          flight_id: "11111111-1111-1111-1111-111111111111",
          aircraft_id: "22222222-2222-2222-2222-222222222222",
          dispatcher_notes: "VFR throughout",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(createWeatherBriefing).toHaveBeenCalledWith(
      expect.objectContaining({
        flight_id: "11111111-1111-1111-1111-111111111111",
        aircraft_id: "22222222-2222-2222-2222-222222222222",
        dispatcher_notes: "VFR throughout",
      }),
    );
  });

  it("returns a field error when no valid ICAOs are parseable", async () => {
    const result = await createBriefingAction(
      { status: "idle" },
      fd({ airports_raw: "12 !! 9" }),
    );

    expect(result.status).toBe("field-errors");
    if (result.status === "field-errors") {
      expect(result.errors.airports_raw).toMatch(/valid 3–4 letter ICAO/i);
    }
    expect(createWeatherBriefing).not.toHaveBeenCalled();
  });

  it("caps at 10 airports", async () => {
    const eleven = Array.from({ length: 11 }, (_, i) =>
      `KA${String.fromCharCode(65 + i)}A`,
    ).join(" ");
    const result = await createBriefingAction(
      { status: "idle" },
      fd({ airports_raw: eleven }),
    );

    expect(result.status).toBe("field-errors");
    if (result.status === "field-errors") {
      expect(result.errors.airports_raw).toMatch(/maximum 10 airports/i);
    }
  });

  it("returns an empty-input field error when no airport string supplied", async () => {
    const result = await createBriefingAction(
      { status: "idle" },
      fd({ airports_raw: "" }),
    );

    expect(result.status).toBe("field-errors");
    if (result.status === "field-errors") {
      expect(result.errors.airports_raw).toBeDefined();
    }
  });

  it("maps backend flight_not_found to a flight-picker field error", async () => {
    createWeatherBriefing.mockRejectedValueOnce(
      new TestApiError(
        404,
        "/weather/briefings",
        JSON.stringify({ detail: "flight_not_found" }),
      ),
    );

    const result = await createBriefingAction({ status: "idle" }, fd());

    expect(result.status).toBe("field-errors");
    if (result.status === "field-errors") {
      expect(result.errors.flight_id).toMatch(/no longer exists/i);
    }
  });

  it("maps backend aircraft_not_found to an aircraft-picker field error", async () => {
    createWeatherBriefing.mockRejectedValueOnce(
      new TestApiError(
        404,
        "/weather/briefings",
        JSON.stringify({ detail: "aircraft_not_found" }),
      ),
    );

    const result = await createBriefingAction({ status: "idle" }, fd());

    expect(result.status).toBe("field-errors");
    if (result.status === "field-errors") {
      expect(result.errors.aircraft_id).toMatch(/no longer in your fleet/i);
    }
  });

  it("surfaces 401 with the session-expired message", async () => {
    createWeatherBriefing.mockRejectedValueOnce(
      new TestApiError(401, "/weather/briefings", "Unauthorized"),
    );

    const result = await createBriefingAction({ status: "idle" }, fd());

    expect(result.status).toBe("api-error");
    if (result.status === "api-error") {
      expect(result.message).toMatch(/session expired/i);
    }
  });
});
