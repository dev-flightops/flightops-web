import { describe, expect, it } from "vitest";

import { releaseRefusal, scheduleRefusal } from "./schedule-refusals";

const body = (detail: unknown) => JSON.stringify({ detail });

describe("scheduleRefusal (#155)", () => {
  it("says an unknown airport isn't one we know", () => {
    expect(scheduleRefusal(body({ error: "unknown_airport", codes: ["ZZZZ"] }))).toMatch(
      /^ZZZZ isn't an airport we know/,
    );
  });

  it("names the flight a busy aircraft is already on", () => {
    expect(
      scheduleRefusal(
        body({
          error: "aircraft_busy",
          flight_number: "MM001",
          scheduled_departure_at: "2026-10-28T17:00:00+00:00",
          scheduled_arrival_at: "2026-10-28T19:45:00+00:00",
        }),
      ),
    ).toBe("The aircraft is already on MM001 (17:00Z–19:45Z). Pick another aircraft or other times.");
  });

  it("is null for anything else", () => {
    expect(scheduleRefusal(body("flight_number_conflict"))).toBeNull();
    expect(scheduleRefusal("not json")).toBeNull();
  });
});

describe("releaseRefusal (#155)", () => {
  it("names what the FRAT still needs", () => {
    expect(
      releaseRefusal(
        body({
          error: "frat_not_ready",
          blockers: [{ code: "frat_missing", message: "No FRAT on this flight yet." }],
        }),
      ),
    ).toBe("Release blocked — the FRAT: No FRAT on this flight yet.");
  });

  it("says how far over the load is, and from what", () => {
    expect(releaseRefusal(body({ error: "over_max_payload", basis: "typed", over_by_lbs: 5090 }))).toBe(
      "Release blocked — the load is 5,090 lb over the aircraft's useful load, by the passengers and cargo typed on the flight (no manifest yet; passengers at 190 lb).",
    );
  });

  it("asks for the aircraft's weights and the MEL acknowledgments", () => {
    expect(releaseRefusal(body({ error: "aircraft_weights_missing", tail_number: "N200PA" }))).toMatch(
      /^Release blocked — N200PA has no max payload/,
    );
    expect(releaseRefusal(body({ error: "mel_ack_required", missing_mel_ids: ["m-1"] }))).toMatch(
      /acknowledge each open MEL/,
    );
  });
});
