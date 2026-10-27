import { describe, expect, it } from "vitest";

import type { MinimumsStation } from "@/lib/api/types";

import {
  belowMinimumsFromError,
  belowSummary,
  heldForType,
  heldForVfr,
  minimumsLabel,
  withoutApproach,
} from "./weather-minimums";

const STATIONS: MinimumsStation[] = [
  {
    icao: "PABE",
    below: false,
    observations: [
      {
        source: "metar",
        observed_at: null,
        ceiling_ft: 800,
        visibility_sm: 3,
        below_ceiling: false,
        below_visibility: false,
      },
    ],
  },
  {
    icao: "PAEM",
    below: true,
    observations: [
      {
        source: "metar",
        observed_at: null,
        ceiling_ft: 3000,
        visibility_sm: 1.75,
        below_ceiling: false,
        below_visibility: true,
      },
      {
        source: "field_report",
        observed_at: null,
        ceiling_ft: 400,
        visibility_sm: 5,
        below_ceiling: true,
        below_visibility: false,
      },
    ],
  },
];

describe("dispatch minimums in words (#89)", () => {
  it("labels the minimums the way the GOM writes them", () => {
    expect(minimumsLabel(600, "2.0")).toBe("600 ft / 2 sm");
    expect(minimumsLabel(1000, 2.5)).toBe("1,000 ft / 2.5 sm");
  });

  it("names only the stops below, and only what is below at each", () => {
    expect(belowSummary(STATIONS)).toBe(
      "PAEM visibility 1.75 sm; ceiling 400 ft (village report)",
    );
  });

  it("reads release's refusal", () => {
    const body = JSON.stringify({
      detail: {
        error: "below_weather_minimums",
        min_ceiling_ft: 600,
        min_visibility_sm: 2,
        stations: STATIONS.filter((s) => s.below),
      },
    });
    expect(belowMinimumsFromError(body)).toMatch(
      /^Below the company's dispatch minimums for aircraft not IFR certified \(600 ft \/ 2 sm\): PAEM visibility 1\.75 sm/,
    );
  });

  it("gives up on anything else", () => {
    expect(belowMinimumsFromError("not json")).toBeNull();
    expect(belowMinimumsFromError(JSON.stringify({ detail: { error: "other" } }))).toBeNull();
  });
});

describe("dispatch minimums at a field without an instrument approach (#110)", () => {
  it("says so in release's refusal, for any aircraft", () => {
    const body = JSON.stringify({
      detail: {
        error: "below_weather_minimums",
        min_ceiling_ft: 600,
        min_visibility_sm: 2,
        stations: [
          {
            icao: "PAII",
            below: true,
            reason: "no_instrument_approach",
            observations: [
              {
                source: "field_report",
                observed_at: null,
                ceiling_ft: 500,
                visibility_sm: 3,
                below_ceiling: true,
                below_visibility: false,
              },
            ],
          },
        ],
      },
    });
    expect(belowMinimumsFromError(body)).toBe(
      "Below the company's dispatch minimums (600 ft / 2 sm) at a field without an instrument " +
        "approach: PAII ceiling 500 ft (village report). PAII can only be reached VFR, whatever " +
        "the aircraft: no release until the weather there comes up.",
    );
  });

  it("keeps the type's wording where every stop is held for the type", () => {
    expect(
      heldForType([
        { icao: "PABE", below: false, reason: "not_ifr_certified", observations: [] },
        { icao: "PAEM", below: true, observations: [] },
      ]),
    ).toBe(true);
    expect(
      withoutApproach([
        { icao: "PAII", below: true, reason: "no_instrument_approach", observations: [] },
        { icao: "9Z8", below: true, reason: "no_instrument_approach", observations: [] },
      ]),
    ).toBe("PAII and 9Z8");
  });
});

describe("dispatch minimums on a VFR flight (#123)", () => {
  const VFR_STOPS = [
    {
      icao: "PABE",
      below: true,
      reason: "vfr_flight" as const,
      observations: [
        {
          source: "metar" as const,
          observed_at: null,
          ceiling_ft: 500,
          visibility_sm: 5,
          below_ceiling: true,
          below_visibility: false,
        },
      ],
    },
    { icao: "PAKI", below: false, reason: "vfr_flight" as const, observations: [] },
  ];

  it("says the flight is flown VFR, and how to mark it IFR", () => {
    expect(heldForType(VFR_STOPS)).toBe(false);
    expect(heldForVfr(VFR_STOPS)).toBe(true);
    const body = JSON.stringify({
      detail: {
        error: "below_weather_minimums",
        min_ceiling_ft: 600,
        min_visibility_sm: 2,
        stations: VFR_STOPS,
      },
    });
    expect(belowMinimumsFromError(body)).toBe(
      "Below the company's dispatch minimums for a VFR flight (600 ft / 2 sm): PABE ceiling " +
        "500 ft. No release until it comes up. If the flight will be flown IFR, tick Flown IFR " +
        "under Edit.",
    );
  });

  it("is not a VFR hold on an IFR flight held at a field without an approach", () => {
    expect(
      heldForVfr([{ icao: "PAII", below: true, reason: "no_instrument_approach", observations: [] }]),
    ).toBe(false);
  });
});
