import { describe, expect, it } from "vitest";

import { refusalMessage } from "./messages";

const body = (detail: unknown) => JSON.stringify({ detail });

describe("check-in refusals in words (#103)", () => {
  it("names what the company still requires", () => {
    expect(
      refusalMessage(body({ error: "check_in_incomplete", missing: ["Bag count", "ID verified"] })),
    ).toBe("Still needed: Bag count, ID verified.");
  });

  it("names who has to be dealt with before boarding closes", () => {
    expect(refusalMessage(body({ error: "passengers_unresolved", passengers: ["Ben Brooks"] }))).toBe(
      "Check these passengers in, or mark them as no-shows, before closing boarding: Ben Brooks.",
    );
  });

  it("explains the state refusals", () => {
    expect(refusalMessage(body("boarding_not_open"))).toBe("Begin boarding first.");
    expect(refusalMessage(body("marked_no_show"))).toBe("They're marked as a no-show. Undo that first.");
    expect(refusalMessage(body("manifest_locked"))).toBe(
      "The manifest is locked, so nothing more can change.",
    );
  });

  it("says which of the company's fields is wrong", () => {
    expect(refusalMessage(body({ error: "not_an_option", field: "Home village" }))).toBe(
      "Home village: pick one of the options.",
    );
  });

  it("says by how much a flight is over its useful load (#146)", () => {
    expect(refusalMessage(body({ error: "over_weight", over_by_lbs: 306, useful_load_lbs: 1400 }))).toBe(
      "306 lb over the aircraft's useful load of 1,400 lb. Offload bags or freight, or move a passenger, before boarding.",
    );
  });

  it("leaves anything else to the caller", () => {
    expect(refusalMessage(body("something_new"))).toBeNull();
    expect(refusalMessage("not json")).toBeNull();
  });
});
