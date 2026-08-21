import { describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "./client";
import { listFlights } from "./ops";

const mockedApiFetch = vi.mocked(apiFetch);

describe("listFlights", () => {
  // This module had no test file until the assignedToMe work. Worth
  // noting given how the last two bugs in this repo were found: both
  // times the broken thing was the untested thing.

  it("omits the query string entirely when unfiltered", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listFlights();
    expect(mockedApiFetch).toHaveBeenCalledWith("/ops/flights");
  });

  it("composes date and repeated status params", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listFlights({ onDate: "2026-08-21", status: ["scheduled", "released"] });
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/ops/flights?on_date=2026-08-21&status=scheduled&status=released",
    );
  });

  it("sends assigned_to_me=true when asked", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listFlights({ onDate: "2026-08-21", assignedToMe: true });
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/ops/flights?on_date=2026-08-21&assigned_to_me=true",
    );
  });

  it("omits assigned_to_me rather than sending false", async () => {
    // A bare ?assigned_to_me=false in a server log reads like someone
    // deliberately asked for everyone's flights. Omitting it means the
    // same thing to the backend and says less.
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listFlights({ assignedToMe: false });
    expect(mockedApiFetch).toHaveBeenCalledWith("/ops/flights");
  });

  it("does not leak assignedToMe as a literal param name", async () => {
    // The client takes camelCase, the API takes snake_case. Passing the
    // JS name straight through would silently return every flight in the
    // tenant, because FastAPI ignores unknown query params.
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listFlights({ assignedToMe: true });
    const path = String(mockedApiFetch.mock.calls.at(-1)?.[0]);
    expect(path).not.toContain("assignedToMe");
    expect(path).toContain("assigned_to_me=true");
  });

  it("passes limit and offset through", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listFlights({ limit: 50, offset: 100 });
    expect(mockedApiFetch).toHaveBeenCalledWith("/ops/flights?limit=50&offset=100");
  });
});
