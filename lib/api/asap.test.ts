import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({ apiFetch: vi.fn() }));

import { getAsapHub, saveAsapReview } from "./asap";
import { apiFetch } from "./client";

const mockedApiFetch = vi.mocked(apiFetch);

beforeEach(() => mockedApiFetch.mockReset());

describe("ASAP hub client (#59)", () => {
  it("reads the hub from safety-service", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], counts: {} });
    await getAsapHub();
    expect(mockedApiFetch).toHaveBeenCalledWith("/safety/asap");
  });

  it("saves a review with a PUT of every field", async () => {
    mockedApiFetch.mockResolvedValueOnce({});
    const review = {
      review_date: "2026-10-06",
      erc_participants: null,
      decision: "accepted" as const,
      decision_rationale: "Sole source.",
      corrective_action_summary: null,
      de_identified: true,
    };
    await saveAsapReview("r-1", review);
    const [path, init] = mockedApiFetch.mock.calls[0];
    expect(path).toBe("/safety/asap/reviews/r-1");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual(review);
  });
});
