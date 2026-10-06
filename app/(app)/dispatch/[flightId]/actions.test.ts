import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, releaseFlight, packetWeatherFor } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, releaseFlight: vi.fn(), packetWeatherFor: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({ releaseFlight, updateFlight: vi.fn() }));
vi.mock("@/lib/api/dispatch-risk", () => ({ packetWeatherFor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { releaseFlightAction } from "./actions";

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
