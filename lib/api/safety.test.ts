import { describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "./client";
import {
  getHazard,
  listHazards,
  listMyHazards,
  patchHazard,
  submitHazard,
} from "./safety";

const mockedApiFetch = vi.mocked(apiFetch);

function _fixture() {
  return {
    id: "h1",
    category: "ground_ops" as const,
    severity: "medium" as const,
    status: "submitted" as const,
    description: "Loader forks bent.",
    immediate_action_taken: null,
    location_free_text: null,
    station: null,
    is_anonymous: false,
    reporter: null,
    triaged_at: null,
    triaged_by: null,
    closed_at: null,
    closed_by: null,
    closed_reason: null,
    created_at: "2026-07-17T14:00:00Z",
    updated_at: "2026-07-17T14:00:00Z",
  };
}

describe("safety API client", () => {
  it("listHazards passes filters through the query string", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listHazards({ status: "triaged", severity: "high", limit: 25 });
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/safety/hazards?status=triaged&severity=high&limit=25",
    );
  });

  it("listHazards omits the ? when no filters are supplied", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listHazards();
    expect(mockedApiFetch).toHaveBeenCalledWith("/safety/hazards");
  });

  it("listMyHazards hits the /mine endpoint", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listMyHazards({ limit: 10 });
    expect(mockedApiFetch).toHaveBeenCalledWith("/safety/hazards/mine?limit=10");
  });

  it("getHazard interpolates the id", async () => {
    mockedApiFetch.mockResolvedValueOnce(_fixture());
    await getHazard("abc-123");
    expect(mockedApiFetch).toHaveBeenCalledWith("/safety/hazards/abc-123");
  });

  it("submitHazard POSTs the JSON body", async () => {
    mockedApiFetch.mockResolvedValueOnce(_fixture());
    await submitHazard({
      category: "flight_ops",
      severity: "critical",
      description: "Runway incursion.",
      is_anonymous: true,
    });
    expect(mockedApiFetch).toHaveBeenCalledWith("/safety/hazards", {
      method: "POST",
      body: JSON.stringify({
        category: "flight_ops",
        severity: "critical",
        description: "Runway incursion.",
        is_anonymous: true,
      }),
    });
  });

  it("patchHazard PATCHes to the specific id", async () => {
    mockedApiFetch.mockResolvedValueOnce(_fixture());
    await patchHazard("h1", { status: "closed", closed_reason: "resolved" });
    expect(mockedApiFetch).toHaveBeenCalledWith("/safety/hazards/h1", {
      method: "PATCH",
      body: JSON.stringify({ status: "closed", closed_reason: "resolved" }),
    });
  });
});
