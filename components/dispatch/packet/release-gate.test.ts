import { describe, expect, it } from "vitest";

import type {
  ComplianceFinding,
  PicComplianceResponse,
  PicDotColor,
  RouteFreshness,
} from "@/lib/api/types";

import { computeHardBlockReason, overridesOnRecord } from "./release-gate";

function finding(code: string): ComplianceFinding {
  return {
    currency_item_id: `item-${code}`,
    code,
    name: `Item ${code}`,
    regulation: "61.57(a)",
    status: "non_current",
    last_completed_date: null,
    grace_month_end: null,
    message: "needs attention",
  };
}

function pic(
  dot_color: PicDotColor,
  {
    hard = [] as ComplianceFinding[],
    soft = [] as ComplianceFinding[],
  } = {},
): PicComplianceResponse {
  return {
    pilot: { id: "p-1", full_name: "Bob Henderson", email: "bob@test.local" },
    dot_color,
    hard_blocks: hard,
    soft_warnings: soft,
  };
}

/** A route-freshness verdict. Defaults to "everything current". */
function freshness(
  overrides: Partial<RouteFreshness> = {},
): RouteFreshness {
  return {
    stations: [],
    any_stale_metar: false,
    any_stale_field_report: false,
    any_missing_weather: false,
    acknowledgment_required: false,
    stations_requiring_acknowledgment: [],
    ...overrides,
  };
}

/** Baseline: everything satisfied → release allowed. */
const CLEAR = {
  picCompliance: null,
  ackedWarnCodes: new Set<string>(),
  overridesAcknowledged: false,
  hasSelectedFlight: true,
  picAssigned: true,
  icaos: ["PANC", "PABE"],
  notamAckedIcaos: ["PANC", "PABE"],
  weatherFreshness: freshness(),
  staleWeatherAcknowledged: false,
};

describe("computeHardBlockReason", () => {
  it("returns null when nothing blocks", () => {
    expect(computeHardBlockReason(CLEAR)).toBeNull();
  });

  // ---- PIC on the crew -----------------------------------------------------

  it("blocks a flight with no PIC on its crew, before anything else", () => {
    // The release reads the PIC from the roster (29 Sep); a packet that
    // only named one in ?pic= would be refused, and used to skip every
    // PIC check instead.
    expect(
      computeHardBlockReason({
        ...CLEAR,
        picAssigned: false,
        notamAckedIcaos: [],
      }),
    ).toBe("No PIC on this flight's crew — pick one in Flight Details before release.");
  });

  it("does not ask for a PIC when no flight is loaded", () => {
    // A hand-filled packet has no crew to assign to.
    expect(
      computeHardBlockReason({ ...CLEAR, hasSelectedFlight: false, picAssigned: false }),
    ).toBeNull();
  });

  // ---- PIC currency ------------------------------------------------------

  it("blocks on PIC red without an override", () => {
    const reason = computeHardBlockReason({
      ...CLEAR,
      picCompliance: pic("red", { hard: [finding("a"), finding("b")] }),
    });
    expect(reason).toMatch(/Bob Henderson has 2 hard-block currency items/);
  });

  it("singularizes a lone hard block", () => {
    const reason = computeHardBlockReason({
      ...CLEAR,
      picCompliance: pic("red", { hard: [finding("a")] }),
    });
    expect(reason).toMatch(/1 hard-block currency item —/);
  });

  it("clears PIC red when a supervisor override was recorded", () => {
    expect(
      computeHardBlockReason({
        ...CLEAR,
        picCompliance: pic("red", { hard: [finding("a")] }),
        overridesAcknowledged: true,
      }),
    ).toBeNull();
  });

  it("blocks on PIC yellow until every soft warning is acked", () => {
    const base = {
      ...CLEAR,
      picCompliance: pic("yellow", { soft: [finding("a"), finding("b")] }),
    };
    expect(computeHardBlockReason(base)).toMatch(
      /2 of 2 soft warnings still need/,
    );
    expect(
      computeHardBlockReason({ ...base, ackedWarnCodes: new Set(["a"]) }),
    ).toMatch(/1 of 2 soft warnings still need/);
    expect(
      computeHardBlockReason({ ...base, ackedWarnCodes: new Set(["a", "b"]) }),
    ).toBeNull();
  });

  // ---- NOTAM acks --------------------------------------------------------

  it("blocks when a routed ICAO has no NOTAM ack", () => {
    expect(
      computeHardBlockReason({ ...CLEAR, notamAckedIcaos: ["PANC"] }),
    ).toMatch(/NOTAMs not acknowledged for PABE/);
  });

  it("blocks when no NOTAMs are acked at all", () => {
    expect(
      computeHardBlockReason({ ...CLEAR, notamAckedIcaos: [] }),
    ).toMatch(/NOTAMs not acknowledged for PANC, PABE/);
  });

  it("does not gate NOTAMs when no flight is selected", () => {
    expect(
      computeHardBlockReason({
        ...CLEAR,
        hasSelectedFlight: false,
        notamAckedIcaos: [],
      }),
    ).toBeNull();
  });

  it("does not gate NOTAMs for an empty route", () => {
    expect(
      computeHardBlockReason({ ...CLEAR, icaos: [], notamAckedIcaos: [] }),
    ).toBeNull();
  });

  // ---- Precedence / layering --------------------------------------------

  it("surfaces the PIC reason first when PIC AND NOTAMs both block", () => {
    // One tooltip slot: PIC wins. Both still block release — clearing PIC
    // must then reveal the NOTAM block rather than unlocking the button.
    const both = {
      ...CLEAR,
      picCompliance: pic("red", { hard: [finding("a")] }),
      notamAckedIcaos: [],
    };
    expect(computeHardBlockReason(both)).toMatch(/hard-block currency item/);
    // Override clears PIC → the NOTAM block must still hold.
    expect(
      computeHardBlockReason({ ...both, overridesAcknowledged: true }),
    ).toMatch(/NOTAMs not acknowledged/);
  });

  it("still blocks on NOTAMs after every soft warning is acked", () => {
    expect(
      computeHardBlockReason({
        ...CLEAR,
        picCompliance: pic("yellow", { soft: [finding("a")] }),
        ackedWarnCodes: new Set(["a"]),
        notamAckedIcaos: [],
      }),
    ).toMatch(/NOTAMs not acknowledged/);
  });

  it("allows release when PIC is green and every NOTAM is acked", () => {
    expect(
      computeHardBlockReason({ ...CLEAR, picCompliance: pic("green") }),
    ).toBeNull();
  });
});

// ---- HALT-2: stale / missing weather ---------------------------------------
//
// Legacy orders this last (modules/dispatch/form.html): currency, then
// NOTAMs, then weather. Unlike the NOTAM tier this one IS enforced
// server-side too — the release endpoint runs the same evaluator.

describe("computeHardBlockReason — stale weather", () => {
  it("blocks when the route needs a weather acknowledgment", () => {
    const reason = computeHardBlockReason({
      ...CLEAR,
      weatherFreshness: freshness({
        acknowledgment_required: true,
        any_stale_metar: true,
        stations_requiring_acknowledgment: ["PANC"],
      }),
    });
    expect(reason).toMatch(/stale or missing weather/i);
  });

  it("names the offending stations so the dispatcher isn't left hunting", () => {
    const reason = computeHardBlockReason({
      ...CLEAR,
      weatherFreshness: freshness({
        acknowledgment_required: true,
        stations_requiring_acknowledgment: ["PANC", "PABE"],
      }),
    });
    expect(reason).toContain("PANC, PABE");
  });

  it("clears once the dispatcher acknowledges", () => {
    const reason = computeHardBlockReason({
      ...CLEAR,
      weatherFreshness: freshness({
        acknowledgment_required: true,
        stations_requiring_acknowledgment: ["PANC"],
      }),
      staleWeatherAcknowledged: true,
    });
    expect(reason).toBeNull();
  });

  it("does not block when weather is current", () => {
    expect(computeHardBlockReason({ ...CLEAR })).toBeNull();
  });

  it("does not block a route with no flight selected", () => {
    const reason = computeHardBlockReason({
      ...CLEAR,
      hasSelectedFlight: false,
      weatherFreshness: freshness({ acknowledgment_required: true }),
    });
    expect(reason).toBeNull();
  });

  it("does not block when the freshness call failed", () => {
    // Soft-fail: the release endpoint runs the same check server-side, so
    // a weather-service blip degrades the hint rather than stranding
    // every release behind a check we could not make.
    const reason = computeHardBlockReason({
      ...CLEAR,
      weatherFreshness: null,
    });
    expect(reason).toBeNull();
  });

  it("yields to NOTAMs — legacy orders weather last", () => {
    const reason = computeHardBlockReason({
      ...CLEAR,
      notamAckedIcaos: [],
      weatherFreshness: freshness({
        acknowledgment_required: true,
        stations_requiring_acknowledgment: ["PANC"],
      }),
    });
    expect(reason).toMatch(/notam/i);
  });
});

describe("computeHardBlockReason — the SIC seat and soft warnings (27 Sep)", () => {
  const sic = (dot: PicDotColor, opts = {}) => ({
    ...pic(dot, opts),
    pilot: { id: "s-1", full_name: "Sam Second", email: "sam@test.local" },
  });

  it("does not ask a single-pilot flight about an SIC", () => {
    expect(computeHardBlockReason({ ...CLEAR, picCompliance: pic("green") })).toBeNull();
  });

  it("blocks on an SIC hard block, which no override clears", () => {
    const reason = computeHardBlockReason({
      ...CLEAR,
      picCompliance: pic("green"),
      sicCompliance: [sic("red", { hard: [finding("competency_check")] })],
      overridesAcknowledged: true,
    });
    expect(reason).toBe(
      "SIC Sam Second has 1 hard-block currency item — assign a current SIC or clear them before release.",
    );
  });

  it("needs the SIC's warnings acknowledged under the SIC's own key", () => {
    const input = {
      ...CLEAR,
      picCompliance: pic("green"),
      sicCompliance: [sic("yellow", { soft: [finding("sic_day_landing_currency")] })],
    };
    expect(computeHardBlockReason(input)).toBe(
      "1 of 1 soft warnings still need dispatcher acknowledgment.",
    );
    // The PIC's key for the same code does not count for the SIC.
    expect(
      computeHardBlockReason({
        ...input,
        ackedWarnCodes: new Set(["sic_day_landing_currency"]),
      }),
    ).not.toBeNull();
    expect(
      computeHardBlockReason({
        ...input,
        ackedWarnCodes: new Set(["sic:sic_day_landing_currency"]),
      }),
    ).toBeNull();
  });

  it("still needs a PIC's soft warnings acknowledged after an override", () => {
    const reason = computeHardBlockReason({
      ...CLEAR,
      picCompliance: pic("red", {
        hard: [finding("competency_check")],
        soft: [finding("ifr_currency")],
      }),
      overridesAcknowledged: true,
    });
    expect(reason).toBe("1 of 1 soft warnings still need dispatcher acknowledgment.");
  });
});

describe("overridesOnRecord", () => {
  // The dispatcher's packet reads the supervisor's override from the
  // record (29 Sep); it used to be a flag in the recording browser's URL.
  it("is true when every hard block has an override on record", () => {
    const covered = pic("red", {
      hard: [
        { ...finding("a"), override_id: "o-1" },
        { ...finding("b"), override_id: "o-2" },
      ],
    });
    expect(overridesOnRecord(covered)).toBe(true);
  });

  it("is false while any hard block is not covered", () => {
    const partly = pic("red", {
      hard: [{ ...finding("a"), override_id: "o-1" }, finding("b")],
    });
    expect(overridesOnRecord(partly)).toBe(false);
  });

  it("is false with nothing to override, or no check at all", () => {
    expect(overridesOnRecord(pic("green"))).toBe(false);
    expect(overridesOnRecord(null)).toBe(false);
  });
});

// ---- #89: dispatch minimums for aircraft not IFR certified -------------------

describe("computeHardBlockReason — dispatch minimums", () => {
  const BELOW = {
    applies: true,
    airframe_type: "c207",
    min_ceiling_ft: 600,
    min_visibility_sm: "2.0",
    below: true,
    stations: [
      {
        icao: "PABE",
        below: true,
        observations: [
          {
            source: "metar" as const,
            observed_at: "2026-10-20T16:39:00Z",
            ceiling_ft: 500,
            visibility_sm: 1.5,
            below_ceiling: true,
            below_visibility: true,
          },
        ],
      },
    ],
  };

  it("blocks below the minimums, naming the stop and the numbers", () => {
    const reason = computeHardBlockReason({ ...CLEAR, weatherMinimums: BELOW });
    expect(reason).toBe(
      "Below the company's dispatch minimums for aircraft not IFR certified (600 ft / 2 sm): " +
        "PABE ceiling 500 ft, visibility 1.5 sm. No release until it comes up, or move the " +
        "flight to an IFR-certified aircraft.",
    );
  });

  it("is not cleared by acknowledging stale weather, and comes before it", () => {
    const reason = computeHardBlockReason({
      ...CLEAR,
      weatherMinimums: BELOW,
      weatherFreshness: freshness({
        acknowledgment_required: true,
        stations_requiring_acknowledgment: ["PABE"],
      }),
      staleWeatherAcknowledged: true,
    });
    expect(reason).toMatch(/dispatch minimums/);
  });

  it("does not block when they are met, don't apply, or couldn't be read", () => {
    expect(
      computeHardBlockReason({ ...CLEAR, weatherMinimums: { ...BELOW, below: false } }),
    ).toBeNull();
    expect(
      computeHardBlockReason({ ...CLEAR, weatherMinimums: { ...BELOW, applies: false } }),
    ).toBeNull();
    expect(computeHardBlockReason({ ...CLEAR, weatherMinimums: null })).toBeNull();
  });
});

describe("computeHardBlockReason — #155 the MELs, the FRAT and the load", () => {
  it("blocks on an open MEL this dispatcher hasn't acknowledged", () => {
    expect(
      computeHardBlockReason({ ...CLEAR, openMelIds: ["m-1", "m-2"], ackedMelIds: ["m-1"] }),
    ).toBe("1 open MEL item still needs dispatcher acknowledgment.");
    expect(
      computeHardBlockReason({ ...CLEAR, openMelIds: ["m-1"], ackedMelIds: ["m-1"] }),
    ).toBeNull();
  });

  it("blocks on what the FRAT still needs, naming the first", () => {
    expect(
      computeHardBlockReason({
        ...CLEAR,
        fratBlockers: [
          { code: "frat_pilot_unsigned", message: "The pilot hasn't signed the FRAT." },
          { code: "frat_dispatcher_unsigned", message: "A dispatcher hasn't signed the FRAT." },
        ],
      }),
    ).toBe("FRAT: The pilot hasn't signed the FRAT. (and 1 more)");
    expect(computeHardBlockReason({ ...CLEAR, fratBlockers: [] })).toBeNull();
    // Couldn't be read: release still checks it.
    expect(computeHardBlockReason({ ...CLEAR, fratBlockers: null })).toBeNull();
  });

  it("blocks a load over the useful load, saying where it came from", () => {
    expect(
      computeHardBlockReason({
        ...CLEAR,
        fratBlockers: [],
        releaseLoad: { basis: "typed", useful_load_lbs: 1400, payload_lbs: 6140, remaining_lbs: "-5090.0" },
      }),
    ).toBe(
      "Over the aircraft's useful load by 5,090 lb, by the passengers and cargo typed on the flight.",
    );
    expect(
      computeHardBlockReason({
        ...CLEAR,
        releaseLoad: { basis: "manifest", useful_load_lbs: null, payload_lbs: 0, remaining_lbs: null },
      }),
    ).toMatch(/no max payload on record/);
    expect(
      computeHardBlockReason({
        ...CLEAR,
        releaseLoad: { basis: "manifest", useful_load_lbs: 1400, payload_lbs: 600, remaining_lbs: 210 },
      }),
    ).toBeNull();
  });
});
