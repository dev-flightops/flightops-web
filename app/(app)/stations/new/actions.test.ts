import { describe, expect, it, vi } from "vitest";

const { TestApiError, createStation } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, createStation: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({ createStation, STATIONS_CACHE_TAG: "stations" }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { createStationAction } from "./actions";

describe("createStationAction refused by role (29 Sep)", () => {
  it("says who can add a station", async () => {
    createStation.mockRejectedValueOnce(new TestApiError(403, "/ground/stations", "insufficient_role"));
    const fd = new FormData();
    fd.set("icao_code", "PAHP");
    fd.set("name", "Hooper Bay");
    expect(await createStationAction({ status: "idle" }, fd)).toEqual({
      status: "api-error",
      message: "Only Ground Ops, the Director of Operations or an Exec Admin can add a station.",
    });
  });
});
