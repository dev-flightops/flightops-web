import { describe, expect, it } from "vitest";

import { flightStops, parseRouteText, routeText, withAlternate } from "./route";

describe("withAlternate (1119-18)", () => {
  it("adds an IFR flight's alternate after its stops, once", () => {
    const stops = ["PABE", "PADM", "PABE"];
    expect(withAlternate({ is_ifr: true, alternate_ident: "pani" }, stops)).toEqual(["PABE", "PADM", "PABE", "PANI"]);
    expect(withAlternate({ is_ifr: true, alternate_ident: "PADM" }, stops)).toEqual(stops);
    expect(withAlternate({ is_ifr: false, alternate_ident: "PANI" }, stops)).toEqual(stops);
    expect(withAlternate({ is_ifr: true, alternate_ident: null }, stops)).toEqual(stops);
  });
});

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
