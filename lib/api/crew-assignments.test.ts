import { describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({ apiFetch: vi.fn() }));

import { apiFetch } from "./client";
import {
  assignFlightCrew,
  listFlightCrew,
  unassignFlightCrew,
} from "./crew-assignments";

const mockedApiFetch = vi.mocked(apiFetch);

describe("crew assignment client", () => {
  it("lists the roster for a flight", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], has_pic: false });
    await listFlightCrew("f-1");
    expect(mockedApiFetch).toHaveBeenCalledWith("/ops/flights/f-1/crew");
  });

  it("posts the seat as snake_case", async () => {
    // crew_role, not crewRole — FastAPI would 422 on the wrong key, but
    // only for a required field. Worth pinning rather than trusting.
    mockedApiFetch.mockResolvedValueOnce({});
    await assignFlightCrew("f-1", { user_id: "u-1", crew_role: "pic" });
    expect(mockedApiFetch).toHaveBeenCalledWith("/ops/flights/f-1/crew", {
      method: "POST",
      body: JSON.stringify({ user_id: "u-1", crew_role: "pic" }),
    });
  });

  it("deletes by user id, not assignment id", async () => {
    // The route is /crew/{user_id}. Passing the assignment row's id
    // would 404 — and a 404 here reads as "not on this flight", which
    // is exactly the wrong thing to believe.
    mockedApiFetch.mockResolvedValueOnce(undefined);
    await unassignFlightCrew("f-1", "u-1");
    expect(mockedApiFetch).toHaveBeenCalledWith("/ops/flights/f-1/crew/u-1", {
      method: "DELETE",
    });
  });
});
