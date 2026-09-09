import { describe, expect, it, vi } from "vitest";

const { TestApiError, createCharter, transitionCharter } = vi.hoisted(() => {
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
    createCharter: vi.fn(async () => ({ id: "c-1" })),
    transitionCharter: vi.fn(),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/charter", () => ({
  CHARTER_STATUSES: ["requested", "quoted", "confirmed", "cancelled"],
  createCharter,
  transitionCharter,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createCharterAction } from "./actions";

/**
 * Airport identifiers on a charter request.
 *
 * Same rule as a booking, for the same reason: a charter filed against
 * an airport that cannot exist can never be matched to a flight. The
 * check here was a length range (3–10), which let "PANC`" through.
 */

function form(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const fields: Record<string, string> = {
    customer_id: "11111111-1111-4111-8111-111111111111",
    origin_icao: "PANC",
    destination_icao: "PABE",
    requested_date: "2026-09-20",
    pax_count: "2",
    ...over,
  };
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const submit = (over: Record<string, string> = {}) =>
  createCharterAction({ status: "idle" }, form(over));

describe("a malformed identifier", () => {
  it.each(["PANC`", "PA", "PANCX", "PA-C", "P@NC", ""])(
    "is refused: %s",
    async (bad) => {
      createCharter.mockClear();
      const result = await submit({ origin_icao: bad });
      expect(result.status).toBe("error");
      expect(result.message).toMatch(/origin should be an airport code/i);
      expect(createCharter).not.toHaveBeenCalled();
    },
  );

  it("is refused as a destination too", async () => {
    const result = await submit({ destination_icao: "PABE`" });
    expect(result.status).toBe("error");
    expect(result.message).toMatch(/destination should be an airport code/i);
  });
});

describe("a real identifier", () => {
  it.each(["PANC", "A61", "5KE", "BET"])("is accepted: %s", async (good) => {
    // Three is the floor: the village strips go by FAA designators,
    // which are three or four alphanumerics and can lead with a digit.
    createCharter.mockClear();
    await submit({ origin_icao: good });
    expect(createCharter).toHaveBeenCalledWith(
      expect.objectContaining({ origin_icao: good }),
    );
  });

  it("is upper-cased on the way through", async () => {
    createCharter.mockClear();
    await submit({ origin_icao: "panc", destination_icao: " pabe " });
    expect(createCharter).toHaveBeenCalledWith(
      expect.objectContaining({ origin_icao: "PANC", destination_icao: "PABE" }),
    );
  });
});
