import { describe, expect, it } from "vitest";

import type { FlightLogLeg } from "@/lib/api/types";

import { computeFlightLogSummary } from "./summary-fields";

function leg(over: Partial<FlightLogLeg> = {}): FlightLogLeg {
  return {
    id: `leg-${Math.random().toString(36).slice(2, 8)}`,
    flight_log_id: "log-1",
    leg_number: 1,
    origin_icao: null,
    dest_icao: null,
    engine_on: null,
    blocks_off: null,
    blocks_on: null,
    engine_off: null,
    crosses_midnight: false,
    start_hobbs: null,
    end_hobbs: null,
    landings: 0,
    night_landings: 0,
    pilot_flying: "pic",
    routing: null,
    basic_empty_weight_lbs: null,
    pilot_weight_lbs: null,
    sic_weight_lbs: null,
    pax_weight_lbs: null,
    baggage_weight_lbs: null,
    cargo_weight_lbs: null,
    fuel_gallons: null,
    fuel_weight_lbs: null,
    trend_data: {},
    ...over,
  };
}

describe("computeFlightLogSummary", () => {
  it("returns zero/null totals for an empty leg list", () => {
    const s = computeFlightLogSummary([]);
    expect(s).toEqual({
      legCount: 0,
      totalFlightHours: null,
      totalBlockHours: null,
      totalHobbsHours: null,
      totalLandings: 0,
      totalNightLandings: 0,
      totalFuelGallons: null,
    });
  });

  it("sums a single fully-populated leg", () => {
    const s = computeFlightLogSummary([
      leg({
        engine_on: "08:00:00",
        blocks_off: "08:05:00",
        blocks_on: "09:35:00",
        engine_off: "09:40:00",
        start_hobbs: 1200.4,
        end_hobbs: 1202.1,
        landings: 1,
        night_landings: 0,
        fuel_gallons: 35,
      }),
    ]);
    expect(s.legCount).toBe(1);
    // 08:00 → 09:40 = 1h 40m = 1.666... → 1.7
    expect(s.totalFlightHours).toBe(1.7);
    // 08:05 → 09:35 = 1h 30m = 1.5
    expect(s.totalBlockHours).toBe(1.5);
    expect(s.totalHobbsHours).toBe(1.7);
    expect(s.totalLandings).toBe(1);
    expect(s.totalNightLandings).toBe(0);
    expect(s.totalFuelGallons).toBe(35);
  });

  it("sums multiple legs", () => {
    const s = computeFlightLogSummary([
      leg({
        engine_on: "08:00:00",
        engine_off: "09:00:00",
        blocks_off: "08:05:00",
        blocks_on: "08:55:00",
        start_hobbs: 100,
        end_hobbs: 101,
        landings: 1,
        night_landings: 0,
        fuel_gallons: 30,
      }),
      leg({
        engine_on: "10:00:00",
        engine_off: "11:30:00",
        blocks_off: "10:05:00",
        blocks_on: "11:25:00",
        start_hobbs: 101,
        end_hobbs: 102.5,
        landings: 2,
        night_landings: 1,
        fuel_gallons: 45,
      }),
    ]);
    expect(s.legCount).toBe(2);
    // 1h + 1h30m = 2.5
    expect(s.totalFlightHours).toBe(2.5);
    // 50min + 1h20m = 2h10m = 2.166... → 2.2
    expect(s.totalBlockHours).toBe(2.2);
    expect(s.totalHobbsHours).toBe(2.5);
    expect(s.totalLandings).toBe(3);
    expect(s.totalNightLandings).toBe(1);
    expect(s.totalFuelGallons).toBe(75);
  });

  it("treats null endpoints as 'no contribution', not zero", () => {
    const s = computeFlightLogSummary([
      leg({ engine_on: "08:00:00", engine_off: null }),
    ]);
    expect(s.totalFlightHours).toBeNull();
    expect(s.totalBlockHours).toBeNull();
    expect(s.totalHobbsHours).toBeNull();
    expect(s.totalFuelGallons).toBeNull();
    // Landings still concrete — non-nullable field.
    expect(s.totalLandings).toBe(0);
  });

  it("partial population: some legs missing times still sum the others", () => {
    const s = computeFlightLogSummary([
      leg({
        engine_on: "08:00:00",
        engine_off: "09:00:00",
        fuel_gallons: 30,
      }),
      leg({ engine_on: null, engine_off: null, fuel_gallons: null }),
    ]);
    expect(s.totalFlightHours).toBe(1);
    expect(s.totalFuelGallons).toBe(30);
  });

  it("handles crosses_midnight by adding 24h to end clock", () => {
    const s = computeFlightLogSummary([
      leg({
        // Red-eye: depart 23:30, arrive 01:15 next day.
        engine_on: "23:30:00",
        blocks_off: "23:35:00",
        blocks_on: "01:10:00",
        engine_off: "01:15:00",
        crosses_midnight: true,
      }),
    ]);
    // 23:30 → 25:15 = 1h 45m = 1.75 → 1.8
    expect(s.totalFlightHours).toBe(1.8);
    // 23:35 → 25:10 = 1h 35m = 1.583... → 1.6
    expect(s.totalBlockHours).toBe(1.6);
  });

  it("returns null contribution when end < start without crosses_midnight", () => {
    // Malformed leg — UI shouldn't let this happen, but defensively
    // treat negative durations as 'unknown', not negative hours.
    const s = computeFlightLogSummary([
      leg({
        engine_on: "10:00:00",
        engine_off: "09:00:00",
        crosses_midnight: false,
      }),
    ]);
    expect(s.totalFlightHours).toBeNull();
  });

  it("accepts HH:MM clock strings as well as HH:MM:SS", () => {
    const s = computeFlightLogSummary([
      leg({ engine_on: "08:00", engine_off: "09:30" }),
    ]);
    expect(s.totalFlightHours).toBe(1.5);
  });

  it("rejects malformed clock strings (returns null contribution)", () => {
    const s = computeFlightLogSummary([
      leg({ engine_on: "garbage", engine_off: "09:00:00" }),
    ]);
    expect(s.totalFlightHours).toBeNull();
  });
});
