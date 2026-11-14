import { describe, expect, it } from "vitest";

import { FACTOR_GROUPS, factorLabel, yesNoScore } from "./factors";

// Mountain terrain (LOG-03): the client, 11/13, "yes or no and add a small
// risk for terrain maybe a point in day two at night if marked yes".
describe("mountain terrain", () => {
  it("is asked yes or no in place of the terrain scale", () => {
    const route = FACTOR_GROUPS.find((g) => g.group === "Route / Terrain")!.factors.map((f) => f.code);
    expect(route).toEqual(["route_mountain", "route_remote", "route_airport"]);
  });

  it.each([
    [false, false, 0],
    [false, true, 0],
    [true, false, 1],
    [true, true, 2],
    [true, null, 2],
    [true, undefined, 2],
  ])("scores yes=%s at night=%s as %i", (yes, night, score) => {
    expect(yesNoScore(yes, night)).toBe(score);
  });

  it("still names the terrain scale on FRATs filed with it", () => {
    expect(factorLabel("route_terrain")).toBe("Terrain challenge");
    expect(factorLabel("route_mountain")).toBe("Mountain terrain");
    expect(factorLabel("made_up")).toBe("made_up");
  });
});
