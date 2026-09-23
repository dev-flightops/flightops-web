import { describe, expect, it } from "vitest";

import { payloadAllowance } from "./payload-allowance";

describe("payloadAllowance", () => {
  it("works out what is left for passengers", () => {
    // The flight from the 23 Sep walkthrough: a Cessna 207 at 1,400 lbs
    // with 6 pax and 350 lbs of cargo. The pilot was shown these four
    // numbers and asked to decide.
    const a = payloadAllowance({
      maxPayloadLbs: 1400,
      paxCount: 6,
      cargoLbs: 350,
    })!;
    expect(a.remainingForPaxLbs).toBe(1050);
    expect(a.perPassengerLbs).toBe(175);
    expect(a.cargoAloneExceedsPayload).toBe(false);
  });

  it("rounds the per-passenger figure down", () => {
    // 1000 / 3 is 333.33. Rounding up would tell a pilot they have
    // room they do not have.
    const a = payloadAllowance({
      maxPayloadLbs: 1000,
      paxCount: 3,
      cargoLbs: 0,
    })!;
    expect(a.perPassengerLbs).toBe(333);
  });

  it("flags cargo that is over the payload on its own", () => {
    // No passenger weight can rescue this, so it is over limits on
    // numbers the system holds outright.
    const a = payloadAllowance({
      maxPayloadLbs: 1400,
      paxCount: 2,
      cargoLbs: 1600,
    })!;
    expect(a.cargoAloneExceedsPayload).toBe(true);
    expect(a.remainingForPaxLbs).toBe(-200);
    expect(a.perPassengerLbs).toBeNull();
  });

  it("gives no per-passenger figure when nobody is booked", () => {
    // Dividing by zero passengers has no meaning, and rendering it as
    // "unlimited" would be a dangerous way to say nothing.
    const a = payloadAllowance({
      maxPayloadLbs: 1400,
      paxCount: 0,
      cargoLbs: 350,
    })!;
    expect(a.remainingForPaxLbs).toBe(1050);
    expect(a.perPassengerLbs).toBeNull();
  });

  it("returns null when the aircraft has no recorded payload limit", () => {
    // The limit comes from the loading schedule, not from us. Missing
    // has to read as missing rather than as zero or unlimited.
    expect(
      payloadAllowance({ maxPayloadLbs: null, paxCount: 6, cargoLbs: 350 }),
    ).toBeNull();
    expect(
      payloadAllowance({ maxPayloadLbs: 0, paxCount: 6, cargoLbs: 350 }),
    ).toBeNull();
  });

  it("treats absent cargo as none rather than unknown", () => {
    // A flight with no cargo recorded is the normal empty-hold case,
    // unlike a missing payload limit which is a gap in the aircraft
    // record.
    const a = payloadAllowance({
      maxPayloadLbs: 1400,
      paxCount: 4,
      cargoLbs: null,
    })!;
    expect(a.remainingForPaxLbs).toBe(1400);
    expect(a.perPassengerLbs).toBe(350);
  });

  it("never invents a passenger weight", () => {
    // The point of the module. Nothing it returns implies what a
    // passenger weighs — only what the operator's own limit leaves
    // room for. 190 lb is the figure it would be tempting to assume,
    // and no output here is derived from it.
    const a = payloadAllowance({
      maxPayloadLbs: 1400,
      paxCount: 6,
      cargoLbs: 350,
    })!;
    expect(Object.values(a)).not.toContain(190);
    // 6 x 190 + 350 = 1490, an "over limits" verdict we are not
    // entitled to reach.
    expect(a).not.toHaveProperty("verdict");
    expect(a).not.toHaveProperty("isOverLimits");
  });
});
