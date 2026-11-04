import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What a payroll admin is told after acting on a whole date range (#134).
 * "Already up to date" and "3 created" are different news, and a refusal has
 * to say what to do about it.
 */

const { TestApiError, generatePayEvents, approvePendingPayEvents, revalidatePath } = vi.hoisted(() => {
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
    generatePayEvents: vi.fn(),
    approvePendingPayEvents: vi.fn(),
    revalidatePath: vi.fn(),
  };
});

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/validation-errors", () => ({ refusalText: () => "" }));
vi.mock("@/lib/api/payroll", () => ({
  approvePayEvent: vi.fn(),
  createPayEvent: vi.fn(),
  PAY_EVENT_TYPES: [],
  generatePayEvents,
  approvePendingPayEvents,
}));

import { approvePendingPayEventsAction, generatePayEventsAction } from "./actions";

beforeEach(() => vi.clearAllMocks());

describe("bringing a range up to date", () => {
  it("says what changed", async () => {
    generatePayEvents.mockResolvedValue({ created: 3, updated: 1, removed: 2 });
    expect(await generatePayEventsAction("2026-08-01", "2026-08-14")).toEqual({
      status: "ok",
      message: "3 created, 1 updated, 2 removed.",
    });
    expect(generatePayEvents).toHaveBeenCalledWith("2026-08-01", "2026-08-14");
    expect(revalidatePath).toHaveBeenCalledWith("/payroll");
    expect(revalidatePath).toHaveBeenCalledWith("/payroll/periods");
  });

  it("leaves out what didn't happen", async () => {
    generatePayEvents.mockResolvedValue({ created: 0, updated: 2, removed: 0 });
    expect((await generatePayEventsAction("a", "b")).message).toBe("2 updated.");
  });

  it("says so when nothing needed doing", async () => {
    generatePayEvents.mockResolvedValue({ created: 0, updated: 0, removed: 0 });
    expect((await generatePayEventsAction("a", "b")).message).toBe("Already up to date.");
  });

  it.each([
    [422, "range_too_long", "That's too long a range: 92 days at a time."],
    [422, "end_before_start", "The end date is before the start date."],
    [401, "", "Your session expired. Sign in again, then retry."],
    [403, "", "Only an Exec Admin can do that."],
    [500, "boom", "That didn't work (HTTP 500)."],
  ])("explains a %i %s", async (status, detail, message) => {
    generatePayEvents.mockRejectedValue(new TestApiError(status, "/x", detail));
    expect(await generatePayEventsAction("a", "b")).toEqual({ status: "error", message });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("explains a server it couldn't reach", async () => {
    generatePayEvents.mockRejectedValue(new TypeError("fetch failed"));
    expect((await generatePayEventsAction("a", "b")).message).toMatch(/Could not reach/);
  });
});

describe("approving a range", () => {
  it("says how many", async () => {
    approvePendingPayEvents.mockResolvedValue({ approved: 40, left_to_check: 0 });
    expect(await approvePendingPayEventsAction("2026-08-01", "2026-08-14")).toEqual({
      status: "ok",
      message: "Approved 40.",
    });
    expect(approvePendingPayEvents).toHaveBeenCalledWith("2026-08-01", "2026-08-14");
    expect(revalidatePath).toHaveBeenCalledWith("/payroll/periods");
  });

  it("says what it left for a look", async () => {
    approvePendingPayEvents.mockResolvedValue({ approved: 40, left_to_check: 2 });
    expect((await approvePendingPayEventsAction("a", "b")).message).toBe(
      "Approved 40. 2 left for you to check.",
    );
  });

  it("explains a refusal", async () => {
    approvePendingPayEvents.mockRejectedValue(new TestApiError(403, "/x", ""));
    expect((await approvePendingPayEventsAction("a", "b")).status).toBe("error");
  });
});
