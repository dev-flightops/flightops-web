import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  TestApiError,
  releaseFlight,
  packetWeatherFor,
  cancelFlight,
  pullBackRelease,
  moveFlightDay,
  resolveWeightReturn,
  getFlightManifest,
} = vi.hoisted(() => {
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
    releaseFlight: vi.fn(),
    packetWeatherFor: vi.fn(),
    cancelFlight: vi.fn(),
    pullBackRelease: vi.fn(),
    moveFlightDay: vi.fn(),
    resolveWeightReturn: vi.fn(),
    getFlightManifest: vi.fn(),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({
  releaseFlight,
  updateFlight: vi.fn(),
  cancelFlight,
  pullBackRelease,
  moveFlightDay,
  resolveWeightReturn,
}));
vi.mock("@/lib/api/manifest", () => ({ getFlightManifest }));
vi.mock("@/lib/api/dispatch-risk", () => ({ packetWeatherFor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  cancelReleasedFlightAction,
  flightWalkUpsAction,
  markReplannedAction,
  moveFlightDayAction,
  pullBackReleaseAction,
  releaseFlightAction,
} from "./actions";

/**
 * What a dispatcher reads when the release is refused. The three at the
 * top are new on 29 Sep: the backend reads the PIC from the crew roster
 * and checks override records instead of trusting the packet's flag.
 */

function refuse(detail: unknown) {
  releaseFlight.mockRejectedValueOnce(
    new TestApiError(409, "/ops/flights/f-1/release", JSON.stringify({ detail })),
  );
}

beforeEach(() => {
  releaseFlight.mockReset();
  packetWeatherFor.mockReset().mockResolvedValue(null);
});

describe("releaseFlightAction (#52)", () => {
  it("sends the weather the dispatch packet keeps", async () => {
    const weather = { stops: [], area_forecast: null };
    packetWeatherFor.mockResolvedValueOnce(weather);
    releaseFlight.mockResolvedValueOnce({});
    expect(await releaseFlightAction("f-1", "u-1", false, false, ["PABE"], [])).toEqual({
      ok: true,
    });
    expect(packetWeatherFor).toHaveBeenCalledWith("f-1");
    expect(releaseFlight).toHaveBeenCalledWith(
      "f-1",
      "u-1",
      false,
      false,
      [{ icao: "PABE" }],
      [],
      weather,
    );
  });
});

describe("releaseFlightAction refusals", () => {
  it("says where to put a PIC when the flight has none", async () => {
    refuse({ error: "pic_required" });
    expect(await releaseFlightAction("f-1")).toEqual({
      ok: false,
      error:
        "Release blocked — this flight has no PIC on its crew. Pick one in Flight Details, then release.",
    });
  });

  it("says to reload when the packet was checking someone other than the PIC", async () => {
    refuse({ error: "pic_mismatch", rostered_pic_user_id: "u-2" });
    const result = await releaseFlightAction("f-1", "u-1");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/PIC changed since this page loaded.*Reload the packet/);
  });

  it("says who must record an override that is not on record", async () => {
    refuse({ error: "override_missing", missing: [{ code: "ipc", name: "IPC" }] });
    const result = await releaseFlightAction("f-1", "u-1", true);
    expect(!result.ok && result.error).toBe(
      "Release blocked — there is no supervisor override on record for this flight's hard-block items. A Chief Pilot, Director of Operations or Exec Admin has to record it from their own login.",
    );
  });

  it("still names a hard block with no override attempted", async () => {
    refuse({ error: "pic_hard_blocked", pilot: {}, hard_blocks: [] });
    const result = await releaseFlightAction("f-1", "u-1");
    expect(!result.ok && result.error).toMatch(/assigned PIC has hard-block currency items/);
  });
});

describe("pulling back or cancelling a release (#90)", () => {
  beforeEach(() => {
    cancelFlight.mockReset();
    pullBackRelease.mockReset();
  });

  it("sends the reason with the pull-back and the cancellation", async () => {
    pullBackRelease.mockResolvedValueOnce({});
    cancelFlight.mockResolvedValueOnce({});
    expect(await pullBackReleaseAction("f-1", "PABE below minimums")).toEqual({ ok: true });
    expect(pullBackRelease).toHaveBeenCalledWith("f-1", "PABE below minimums");
    expect(await cancelReleasedFlightAction("f-1", "Customer cancelled")).toEqual({ ok: true });
    expect(cancelFlight).toHaveBeenCalledWith("f-1", "Customer cancelled");
  });

  it("says a departed flight can no longer be pulled back", async () => {
    pullBackRelease.mockRejectedValueOnce(
      new TestApiError(409, "/ops/flights/f-1/pull-back-release", JSON.stringify({ detail: "flight_already_departed" })),
    );
    expect(await pullBackReleaseAction("f-1", "too late")).toEqual({
      ok: false,
      error: "This flight has departed, so its release can no longer be taken back.",
    });
  });

  it("says when the flight is no longer released", async () => {
    cancelFlight.mockRejectedValueOnce(
      new TestApiError(409, "/ops/flights/f-1/cancel", JSON.stringify({ detail: "flight_not_cancellable_in_status_cancelled" })),
    );
    expect(await cancelReleasedFlightAction("f-1", "Customer cancelled")).toEqual({
      ok: false,
      error: "This flight is no longer released. Refresh to see where it stands.",
    });
  });

  it("says who may do it", async () => {
    pullBackRelease.mockRejectedValueOnce(new TestApiError(403, "/ops/flights/f-1/pull-back-release", "{}"));
    expect(await pullBackReleaseAction("f-1", "weather")).toEqual({
      ok: false,
      error: "Only a dispatcher or an Exec Admin can do this.",
    });
  });
});

describe("moving a flight to another day (#174)", () => {
  const refused = (status: number, detail: unknown) =>
    new TestApiError(status, "/ops/flights/f-1/move-day", JSON.stringify({ detail }));

  it("hands back what moved", async () => {
    const moved = { days: 1, release_withdrawn: false };
    moveFlightDay.mockResolvedValueOnce(moved);
    await expect(moveFlightDayAction("f-1", "2026-10-31", "")).resolves.toEqual({ ok: true, moved });
    expect(moveFlightDay).toHaveBeenCalledWith("f-1", "2026-10-31", undefined);
  });

  it.each([
    [400, "reason_required", "Give the reason"],
    [422, "already_that_day", "already on that day"],
    [422, "move_into_the_past", "already passed"],
    [422, "move_too_far", "over a year away"],
    [409, "flight_already_departed", "has departed"],
    [409, "flight_not_movable_in_status_cancelled", "This flight is cancelled, so it stays on its day."],
    [409, "flight_number_conflict", "already uses that flight number"],
    [403, "forbidden", "Only a dispatcher or an Exec Admin"],
  ])("%s %s says so", async (status, detail, words) => {
    moveFlightDay.mockRejectedValueOnce(refused(status, detail));
    const result = await moveFlightDayAction("f-1", "2026-10-31", "");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain(words);
  });

  it("names the flight a busy aircraft is on", async () => {
    moveFlightDay.mockRejectedValueOnce(
      refused(409, {
        error: "aircraft_busy",
        flight_number: "MM2200",
        scheduled_departure_at: "2026-10-31T17:00:00Z",
        scheduled_arrival_at: "2026-10-31T19:00:00Z",
      }),
    );
    const result = await moveFlightDayAction("f-1", "2026-10-31", "");
    expect(!result.ok && result.error).toContain("already on MM2200");
  });
});

describe("marking a returned flight re-planned (#174)", () => {
  it("saves", async () => {
    resolveWeightReturn.mockResolvedValueOnce({});
    await expect(markReplannedAction("f-1")).resolves.toEqual({ ok: true });
    expect(resolveWeightReturn).toHaveBeenCalledWith("f-1");
  });

  it("takes someone else having got there first as done", async () => {
    resolveWeightReturn.mockRejectedValueOnce(new TestApiError(404, "/x", "no_open_weight_return"));
    await expect(markReplannedAction("f-1")).resolves.toEqual({ ok: true });
  });

  it("says who can when it's refused", async () => {
    resolveWeightReturn.mockRejectedValueOnce(new TestApiError(403, "/x", "forbidden"));
    const result = await markReplannedAction("f-1");
    expect(!result.ok && result.error).toContain("Only dispatch");
  });
});

describe("the passengers a cancelled flight leaves behind (#174)", () => {
  it("are those with no booking, not the crew or a no-show", async () => {
    getFlightManifest.mockResolvedValueOnce({
      pax: [
        { first_name: "Wally", last_name: "Walkup", is_crew: false, booking_id: null },
        { first_name: "Marcus", last_name: "Booked", is_crew: false, booking_id: "b-1" },
        { first_name: "Bob", last_name: "Pilot", is_crew: true, booking_id: null },
        { first_name: "Nora", last_name: "Absent", is_crew: false, booking_id: null, check_in_status: "no_show" },
      ],
    });
    await expect(flightWalkUpsAction("f-1")).resolves.toEqual(["Wally Walkup"]);
  });

  it("are nobody when the flight has no manifest", async () => {
    getFlightManifest.mockRejectedValueOnce(new TestApiError(404, "/x", "no manifest"));
    await expect(flightWalkUpsAction("f-1")).resolves.toEqual([]);
  });
});
