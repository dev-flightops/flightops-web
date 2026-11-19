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

  it("asks to check dates that can't be right (client, 18 Nov)", () => {
    expect(scheduleRefusal(body("flight_longer_than_a_day"))).toBe(
      "The last leg lands more than 24 hours after the first leaves. Check the dates.",
    );
    expect(scheduleRefusal(body("move_into_the_past"))).toBe(
      "That day has passed. Check the date: a flight can't move into the past.",
    );
    expect(scheduleRefusal(body("move_too_far"))).toBe("That's over a year away. Check the date.");
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

  it("says what's outside ForeFlight's weight and balance (#181)", () => {
    expect(
      releaseRefusal(
        body({
          error: "weight_balance_out_of_limits",
          plans: [{ leg_sequence: 1, departure: "PABE", destination: "PAKN", issues: ["Takeoff CG 48.2 in is aft of the limit 47.9"] }],
        }),
      ),
    ).toBe(
      "Release blocked — ForeFlight's weight and balance is outside limits: Takeoff CG 48.2 in is aft of the limit 47.9. Fix the load or the plan in ForeFlight, then bring the plan back.",
    );
  });

  it("names a pilot not cleared under the drug and alcohol program, and not why", () => {
    expect(
      releaseRefusal(
        body({ error: "crew_not_cleared", crew: [{ user_id: "u-1", full_name: "Pat Pilot", seat: "pic" }] }),
      ),
    ).toBe(
      "Release blocked — PIC Pat Pilot isn't cleared for safety-sensitive duty under the drug and alcohol program. Ask the DER, or put another pilot on the flight.",
    );
  });
});

describe("an MEL deferral's limit (#200)", () => {
  it("says what the flight breaks and what to do", () => {
    const said = releaseRefusal(body({ error: "mel_operating_limit", items: [{
  mel_id: "mel-1",
  ata_chapter: "33-40",
  description: "Right nav light inoperative",
  limit: "day_vfr" as const,
  ifr: false,
  night: [],
  unknown: [],
  message: "N100PA is day VFR only under MEL 33-40: the departure from PABE at 18:30 AKST is after civil twilight ends at 17:58.",
}] }));
    expect(said).toBe(
      "Release blocked — N100PA is day VFR only under MEL 33-40: the departure from PABE at 18:30 AKST is after civil twilight ends at 17:58. Move it into daylight, or put another aircraft on it.",
    );
  });

  it("says fly it VFR when the flight is IFR", () => {
    const said = releaseRefusal(
      body({ error: "mel_operating_limit", items: [{ ...{
  mel_id: "mel-1",
  ata_chapter: "33-40",
  description: "Right nav light inoperative",
  limit: "day_vfr" as const,
  ifr: false,
  night: [],
  unknown: [],
  message: "N100PA is day VFR only under MEL 33-40: the departure from PABE at 18:30 AKST is after civil twilight ends at 17:58.",
}, limit: "vfr", ifr: true, message: "N100PA is VFR only under MEL 34-10, and the flight is IFR." }] }),
    );
    expect(said).toMatch(/and the flight is IFR\. Fly it VFR, or put another aircraft on it\.$/);
  });
});
