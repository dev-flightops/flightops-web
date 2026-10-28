import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => {
  class ApiError extends Error {
    constructor(
      public readonly status: number,
      public readonly path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { ApiError };
});

import { ApiError } from "@/lib/api/client";

import { Loads } from "./loads";

const failing = (status: number) => Promise.reject(new ApiError(status, "/x", "no"));

/** #138: a load that fails says what didn't load, instead of looking empty. */
describe("Loads", () => {
  it("gives the value, or the fallback and what failed, in the order asked", async () => {
    const loads = new Loads();
    const [a, b, c] = await Promise.all([
      loads.or(new Promise((resolve) => setTimeout(() => resolve(["x"]), 5)).then(() => failing(500)), [], "the crew list"),
      loads.or(Promise.resolve([1, 2]), [], "the flights"),
      loads.or(failing(422), null, "the customers"),
    ]);
    expect([a, b, c]).toEqual([[], [1, 2], null]);
    // The 422 settled first; the list keeps the order the loads were asked.
    expect(loads.failed).toEqual(["the crew list", "the customers"]);
  });

  it("takes a refusal the viewer is meant to get as nothing to say", async () => {
    const loads = new Loads();
    await loads.or(failing(403), null, "the users");
    await loads.or(failing(404), null, "the manifest");
    await loads.or(failing(409), null, "the plan", [409]);
    expect(loads.failed).toEqual([]);
  });

  it("counts a network failure, and leaves an expired session to the boundary", async () => {
    const loads = new Loads();
    await loads.or(Promise.reject(new TypeError("fetch failed")), null, "the weather");
    expect(loads.failed).toEqual(["the weather"]);
    await expect(loads.or(failing(401), null, "anything")).rejects.toBeInstanceOf(ApiError);
    expect(loads.failed).toEqual(["the weather"]);
  });
});
