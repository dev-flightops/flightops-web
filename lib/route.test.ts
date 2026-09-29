import { describe, expect, it } from "vitest";

import { flightStops, parseRouteText, routeText } from "./route";

describe("route helpers", () => {
  it("reads a multi-leg flight's stops", () => {
    const flight = { origin: "PABE", destination: "PASM", stops: ["PABE", "PAHP", "PASM"] };
    expect(flightStops(flight)).toEqual(["PABE", "PAHP", "PASM"]);
    expect(routeText(flight)).toBe("PABE → PAHP → PASM");
  });

  it("falls back to origin and destination", () => {
    // A single leg, or a service from before the stops existed.
    expect(flightStops({ origin: "PANC", destination: "PABE" })).toEqual(["PANC", "PABE"]);
    expect(flightStops({ origin: "PANC", destination: "PABE", stops: [] })).toEqual(["PANC", "PABE"]);
  });

  it("parses typed routing", () => {
    expect(parseRouteText("panc\npahp, pasm")).toEqual(["PANC", "PAHP", "PASM"]);
  });
});
