import { describe, expect, it } from "vitest";

import { startersFor, WHY_NOT_HERE } from "./starters";

/** The questions suggested first follow the job (#114). */
describe("startersFor", () => {
  it("suggests what each job asks", () => {
    expect(startersFor(["dispatcher"])).toContain("How do I release a flight?");
    expect(startersFor(["pilot"])).toContain("How do I file a FRAT?");
    expect(startersFor(["ground_ops"])).toContain("How do I check passengers in at the gate?");
    expect(startersFor(["maintenance"])).toContain("What makes an aircraft not airworthy?");
    expect(startersFor(["exec_admin"])).toContain("How does a trip go from booking to invoice?");
  });

  it("lets the first matching job decide, and always has four", () => {
    expect(startersFor(["chief_pilot", "pilot"])).toEqual(startersFor(["pilot"]));
    expect(startersFor(["dispatcher", "exec_admin"])).toEqual(startersFor(["dispatcher"]));
    for (const roles of [["dispatcher"], ["pilot"], ["ground_ops"], ["maintenance"], [], ["unknown"]]) {
      expect(startersFor(roles)).toHaveLength(4);
    }
  });
});

describe("startersFor on a page showing a notice (#138)", () => {
  it("asks why first, still four", () => {
    const shown = startersFor(["dispatcher"], true);
    expect(shown[0]).toBe(WHY_NOT_HERE);
    expect(shown).toHaveLength(4);
    expect(shown.slice(1)).toEqual(startersFor(["dispatcher"]).slice(0, 3));
    expect(startersFor(["dispatcher"], false)).not.toContain(WHY_NOT_HERE);
  });
});
