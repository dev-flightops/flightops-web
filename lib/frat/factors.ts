// Catalog mirrors legacy frat_form.html. Adding/removing factors here
// doesn't need a backend change — `answers` is JSONB and the server
// just sums whatever it receives.
//
// Each factor carries:
//   - `hint`    — one-line explanation of what the factor measures,
//     shown under the label so pilots don't have to guess intent.
//   - `anchors` — keyed by slider value 0..5, describing what that
//     value means in Part 135 bush-Alaska terms. Rendered live under
//     the slider so a pilot picking 3 sees "borderline" context
//     immediately instead of a bare integer. Sparse maps are fine —
//     `anchorFor()` picks the nearest defined key ≤ value so 1/2/4
//     can inherit from 0/3.
export interface FratFactor {
  code: string;
  label: string;
  hint: string;
  anchors: Record<number, string>;
}
export const FACTOR_GROUPS: ReadonlyArray<{
  group: string;
  factors: ReadonlyArray<FratFactor>;
}> = [
  {
    group: "Pilot Factors",
    factors: [
      {
        code: "pilot_rest",
        label: "Rest in last 24h",
        hint: "Sleep quality + subjective alertness heading into this flight.",
        anchors: {
          0: "8+ hrs quality sleep · fully alert",
          2: "6–7 hrs sleep · functional but not sharp",
          4: "5 hrs or broken sleep · alertness diminished",
          5: "≤4 hrs sleep or acutely fatigued",
        },
      },
      {
        code: "pilot_currency",
        label: "Aircraft currency & recent hours",
        hint: "Flown this type recently? Comfortable with the cockpit flow?",
        anchors: {
          0: "Flew this type in last 7 days · fully current",
          2: "Within 30-day currency · a little rusty",
          4: "Near edge of Part 61 currency window",
          5: "Marginal or requalifying — recent lapse",
        },
      },
      {
        code: "pilot_duty",
        label: "Duty day length",
        hint: "How far into your duty day does this flight land?",
        // Measured at landing, and prefilled from the duty clock. 5 is
        // the operator's "out of company limits", so it means landing
        // past the duty limit rather than past 12h, which is legal
        // (client, 27 Sep).
        anchors: {
          0: "Lands well under 8h into duty",
          2: "Lands 8–10h into duty, still fresh",
          4: "Lands 10h+ in — heading toward the limit",
          5: "Lands past the duty limit — out of limits",
        },
      },
      {
        code: "pilot_health",
        label: "Health / IMSAFE",
        hint: "Illness, Medication, Stress, Alcohol, Fatigue, Emotion.",
        anchors: {
          0: "IMSAFE all clear · fit to fly",
          2: "Minor cold or off-day, no meds",
          4: "OTC meds, mild illness, life stressors",
          5: "Any IMSAFE flag you'd hesitate to sign for",
        },
      },
    ],
  },
  {
    group: "Aircraft Factors",
    factors: [
      {
        code: "ac_maintenance",
        label: "Maintenance status",
        hint: "MEL items, deferred squawks, upcoming inspection windows.",
        anchors: {
          0: "No open items, well inside inspection intervals",
          2: "1–2 minor non-flight-critical squawks",
          4: "MEL item(s) deferred or inspection imminent",
          5: "Discretionary release — multiple deferrals",
        },
      },
      {
        code: "ac_performance",
        label: "Performance margin",
        hint: "Weight, altitude, temperature vs. the aircraft's book numbers.",
        anchors: {
          0: "Well within 20% of book at full load",
          2: "Standard day, near typical loads",
          4: "Weight × density-altitude squeezes margin",
          5: "At or over performance-chart limits",
        },
      },
      {
        code: "ac_equipment",
        label: "Equipment & avionics readiness",
        hint: "Nav, comm, radar, autopilot — everything you rely on.",
        anchors: {
          0: "All systems nominal, backups verified",
          2: "One redundant system degraded (still legal)",
          4: "Required equipment marginal or intermittent",
          5: "Required equipment inop w/ deferral",
        },
      },
    ],
  },
  {
    group: "Environment / Weather",
    factors: [
      {
        code: "wx_ceiling",
        label: "Ceiling",
        hint: "Cloud-base height above the highest terrain along the route.",
        anchors: {
          0: "Broken/overcast above 3000 ft AGL",
          2: "Ceilings 1500–3000 ft AGL",
          4: "Ceilings 500–1500 ft AGL / low MVFR",
          5: "Near approach minimums along route",
        },
      },
      {
        code: "wx_vis",
        label: "Visibility",
        hint: "Prevailing horizontal visibility en route + at destination.",
        anchors: {
          0: ">6 SM everywhere",
          2: "3–6 SM · MVFR",
          4: "1–3 SM · IFR",
          5: "Near minimums or reduced by precip / smoke",
        },
      },
      {
        code: "wx_wind",
        label: "Wind & gusts",
        hint: "Sustained + gust factor vs. the aircraft's crosswind limit.",
        anchors: {
          0: "<10 kt · calm to light",
          2: "10–18 kt · manageable gust factor",
          4: "18–25 kt · near aircraft crosswind limit",
          5: "Above crosswind limit or gusts >25 kt",
        },
      },
      {
        code: "wx_icing",
        label: "Icing conditions",
        hint: "PIREPs, forecast icing, freezing level along the cruise band.",
        anchors: {
          0: "No icing forecast · well above freezing",
          2: "Trace/light forecast, avoidable",
          4: "Light–moderate in cruise band",
          5: "Moderate+ forecast or PIREP on route",
        },
      },
      {
        code: "wx_turb",
        label: "Turbulence forecast",
        hint: "AIRMETs, SIGMETs, PIREPs for chop en route.",
        anchors: {
          0: "Smooth to light forecast",
          2: "Occasional light, none reported",
          4: "Moderate en route or over terrain",
          5: "Severe forecast or PIREP on route",
        },
      },
    ],
  },
  {
    group: "External Pressures",
    factors: [
      {
        code: "ext_schedule",
        label: "Schedule pressure",
        hint: '"Get-there-itis" from delays, missed slots, or crew swaps.',
        anchors: {
          0: "On time · no downstream impact",
          2: "Late by 30–60 min · recoverable",
          4: "Late enough to affect crew rest or connections",
          5: "Would push a duty limit or misconnect crew",
        },
      },
      {
        code: "ext_passengers",
        label: "Passenger expectations / VIPs",
        hint: "Who's on board and what do they expect of this flight?",
        anchors: {
          0: "Routine load, no external expectations",
          2: "Owner/regular charter on board",
          4: "High-visibility flight or VIP passengers",
          5: '"Have-to-go" pressure, cannot be delayed',
        },
      },
      {
        code: "ext_ops",
        label: "Ops / dispatch pressure",
        hint: "Nudges from dispatch, chief pilot, or ops leadership.",
        anchors: {
          0: "None · dispatch neutral",
          2: "Dispatch checking status regularly",
          4: "Explicit pressure to accept borderline conditions",
          5: "Told to fly against your own judgment",
        },
      },
    ],
  },
  {
    group: "Route / Terrain",
    factors: [
      {
        code: "route_terrain",
        label: "Terrain challenge",
        hint: "Elevation and obstacles under the planned track.",
        anchors: {
          0: "Flat delta or coastline",
          2: "Rolling terrain with scattered obstacles",
          4: "Mountains with defined pass routing",
          5: "High mountainous, single-engine-out-of-glide",
        },
      },
      {
        code: "route_remote",
        label: "Remoteness & SAR access",
        hint: "How long until search-and-rescue could reach you?",
        anchors: {
          0: "Anchorage bowl · SAR minutes away",
          2: "Hub village · day-only SAR",
          4: "Remote village · hours to SAR",
          5: "Truly remote · SAR may not launch until next day",
        },
      },
      {
        code: "route_airport",
        label: "Destination airport challenge",
        hint: "Surface, length, lighting, familiarity, obstructions.",
        anchors: {
          0: "Paved, lit, published approach, familiar",
          2: "Gravel/unlit but flown recently",
          4: "Short strip or unfamiliar destination",
          5: "One-way strip, tight terrain, or first time here",
        },
      },
    ],
  },
];

/** A factor's label as the pilot's FRAT shows it, e.g. "Wind & gusts". */
export function factorLabel(code: string): string {
  return FACTOR_GROUPS.flatMap((g) => g.factors).find((f) => f.code === code)?.label ?? code;
}
