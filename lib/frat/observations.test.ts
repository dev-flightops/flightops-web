import { describe, expect, it } from "vitest";

import type { WeatherBatchResponse, WeatherReportResponse } from "@/lib/api/types";

import { observationsFromWeather } from "./observations";

function report(over: Partial<WeatherReportResponse> = {}): WeatherReportResponse {
  return {
    icao: "PANC",
    kind: "metar",
    raw: "METAR PANC ...",
    parsed_at: "2026-09-23T14:00:00Z",
    valid_until: "2026-09-23T14:05:00Z",
    cache_hit: true,
    flight_category: "VFR",
    alternate_required: false,
    visibility_sm: 10,
    ceiling_ft: 4000,
    wind_direction_deg: 310,
    wind_speed_kt: 8,
    wind_gust_kt: null,
    wind_variable: false,
    wind_calm: false,
    temp_c: 3,
    dewpoint_c: -1,
    altimeter_in_hg: 29.9,
    ...over,
  } as WeatherReportResponse;
}

const batch = (items: WeatherReportResponse[]): WeatherBatchResponse =>
  ({ items, errors: [] }) as WeatherBatchResponse;

/**
 * The adapter's whole job is to say what was observed, accurately,
 * without knowing a single threshold. The backend applies the
 * operator's limits — so what these tests protect is the difference
 * between "not observed" and "observed to be zero / unlimited", which
 * is where this kind of code goes wrong.
 */
describe("observationsFromWeather", () => {
  it("carries the parsed METAR fields through", () => {
    const [obs] = observationsFromWeather(batch([report()]));
    expect(obs).toMatchObject({
      icao: "PANC",
      ceiling_ft: 4000,
      visibility_sm: 10,
      wind_kt: 8,
      gust_kt: null,
    });
  });

  it("keeps a gust when one is reported", () => {
    const [obs] = observationsFromWeather(
      batch([report({ wind_speed_kt: 18, wind_gust_kt: 33 })]),
    );
    expect(obs.wind_kt).toBe(18);
    expect(obs.gust_kt).toBe(33);
  });

  it("reports calm as 0 kt, not as unknown", () => {
    // The distinction that matters: the backend refuses to score a
    // null wind and scores 0 as "no risk". A calm METAR is an
    // observation, so it has to arrive as a number.
    const [obs] = observationsFromWeather(
      batch([report({ wind_calm: true, wind_speed_kt: null })]),
    );
    expect(obs.wind_kt).toBe(0);
  });

  it("passes an unlimited ceiling through as null rather than a number", () => {
    // A clear sky has no ceiling. Inventing one would be a fabricated
    // observation; calling it missing would hide a clear sky. The
    // backend distinguishes both cases, so this must not flatten them.
    const [obs] = observationsFromWeather(
      batch([report({ ceiling_ft: null })]),
    );
    expect(obs.ceiling_ft).toBeNull();
  });

  it("ignores TAFs", () => {
    // A TAF is a forecast over a period and its parsed fields are null
    // anyway — including it would contribute nothing and risk a
    // forecast being read as an observation.
    const obs = observationsFromWeather(
      batch([
        report({ icao: "PANC" }),
        report({ icao: "PABE", kind: "taf", visibility_sm: null }),
      ]),
    );
    expect(obs.map((o) => o.icao)).toEqual(["PANC"]);
  });

  it("returns one entry per airport", () => {
    const obs = observationsFromWeather(
      batch([report({ icao: "PANC" }), report({ icao: "PABE" })]),
    );
    expect(obs).toHaveLength(2);
  });

  it("upper-cases the icao", () => {
    const [obs] = observationsFromWeather(batch([report({ icao: "panc" })]));
    expect(obs.icao).toBe("PANC");
  });

  it("returns nothing when the weather service was unreachable", () => {
    // Null weather is the page's "couldn't fetch" state. Sending no
    // observations gets every factor back unscored with a reason,
    // which is the correct outcome — not a zero.
    expect(observationsFromWeather(null)).toEqual([]);
    expect(observationsFromWeather(undefined)).toEqual([]);
    expect(observationsFromWeather(batch([]))).toEqual([]);
  });

  it("knows no thresholds", async () => {
    // The architectural assertion. If a limit ever appears in this
    // module there are two copies of the operator's policy, and the
    // one on the pilot's screen will drift from the one that scores.
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("lib/frat/observations.ts", "utf8"),
    );
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    for (const threshold of ["30", "35", "1000", "3.0", "vfr_min", "crosswind"]) {
      expect(code).not.toContain(threshold);
    }
  });
});
