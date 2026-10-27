import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * How apiFetch turns a refusal into an error a page can act on: a 401
 * asks for a fresh sign-in, and a 402 is the company read-only until its
 * subscription is paid (#127), with a sentence a form shows as it is.
 */

vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ access_token: "token" })) }));

import {
  ApiError,
  READ_ONLY_MESSAGE,
  ReadOnlyError,
  SessionExpiredError,
  apiFetch,
} from "./client";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://gateway.test");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

/** What apiFetch throws for a POST the gateway refuses. */
async function refusal(): Promise<ApiError> {
  return apiFetch("/ops/flights", { method: "POST" }).then(
    () => {
      throw new Error("expected a refusal");
    },
    (e: ApiError) => e,
  );
}

describe("apiFetch refusals", () => {
  it("a 402 is the company read-only, with a sentence to show", async () => {
    respond(402, { error: "payment_required", reason: "read_only_unpaid", detail: "read_only_unpaid" });
    const err = await refusal();
    expect(err).toBeInstanceOf(ReadOnlyError);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(402);
    expect(err.message).toBe(READ_ONLY_MESSAGE);
    expect(err.message).toMatch(/Flight following, safety reports and clocking out still work/);
  });

  it("a 401 still asks for a fresh sign-in", async () => {
    respond(401, { error: "unauthorized" });
    await expect(apiFetch("/ops/flights")).rejects.toBeInstanceOf(SessionExpiredError);
  });

  it("any other refusal keeps the body for the page to read", async () => {
    respond(403, { detail: "forbidden" });
    const err = await refusal();
    expect(err).not.toBeInstanceOf(ReadOnlyError);
    expect([err.status, JSON.parse(err.message)]).toEqual([403, { detail: "forbidden" }]);
  });
});
