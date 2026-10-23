import { describe, expect, it } from "vitest";

import { distanceNm, findAirport } from "@/lib/airports";

import { addMinutes, legMinutes, legSummary, planLegs } from "./leg-times";

const AK = "America/Anchorage";

describe("the Alaska airport list (#108)", () => {
  it("knows ICAO and FAA codes, Levelock's 9Z8 among them", () => {
    expect(findAirport("pakn")?.name).toBe("King Salmon");
    expect(findAirport("9z8")?.name).toBe("Levelock");
    expect(findAirport("Z13")?.name).toBe("Akiachak");
    expect(findAirport("PAAI")).toBeNull();
    expect(findAirport("")).toBeNull();
  });

  it("measures great-circle distance in nautical miles", () => {
    const nm = distanceNm(findAirport("PAKN")!, findAirport("9Z8")!);
    expect(nm).toBeGreaterThan(27);
    expect(nm).toBeLessThan(28.5);
  });
});

describe("leg times from the cruise speed (#108)", () => {
  it("rounds a leg up to the next 5 minutes, at least 5", () => {
    expect(legMinutes(84, 165)).toBe(35); // 30.5 min
    expect(legMinutes(82.5, 165)).toBe(30); // exactly 30
    expect(legMinutes(3, 165)).toBe(5);
  });

  it("adds minutes in the departure base's zone", () => {
    expect(addMinutes("2026-10-23T08:40", 35, AK)).toBe("2026-10-23T09:15");
    expect(addMinutes("not a time", 35, AK)).toBeNull();
  });

  it("plans a round trip with a ground time at the stop", () => {
    const legs = planLegs({
      airports: ["PABE", "PAEM", "PABE"],
      etd: "2026-10-23T08:00",
      speedKt: 165,
      groundMinutes: 15,
      timeZone: AK,
    });
    expect(legs.map((l) => [l.from, l.to, l.minutes, l.departure, l.arrival])).toEqual([
      ["PABE", "PAEM", 55, "2026-10-23T08:00", "2026-10-23T08:55"],
      ["PAEM", "PABE", 55, "2026-10-23T09:10", "2026-10-23T10:05"],
    ]);
    expect(legSummary(legs[0])).toMatch(/^1\d\d nm · 55 min$/);
  });

  it("stops working out times past an airport it doesn't know, or without a speed", () => {
    const unknown = planLegs({
      airports: ["PAKN", "PAAI", "PAKN"],
      etd: "2026-10-23T08:00",
      speedKt: 165,
      groundMinutes: 15,
      timeZone: AK,
    });
    expect(unknown.map((l) => l.arrival)).toEqual([null, null]);
    expect(legSummary(unknown[0])).toBeNull();

    const noSpeed = planLegs({
      airports: ["PAKN", "9Z8"],
      etd: "2026-10-23T08:00",
      speedKt: null,
      groundMinutes: 15,
      timeZone: AK,
    });
    expect(noSpeed[0].minutes).toBeNull();
    expect(legSummary(noSpeed[0])).toBe("28 nm");
  });
});
