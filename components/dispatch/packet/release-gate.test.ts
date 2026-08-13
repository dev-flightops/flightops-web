import { describe, expect, it } from "vitest";

import type {
  ComplianceFinding,
  PicComplianceResponse,
  PicDotColor,
} from "@/lib/api/types";

import { computeHardBlockReason } from "./release-gate";

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

/** Baseline: everything satisfied → release allowed. */
const CLEAR = {
  picCompliance: null,
  ackedWarnCodes: new Set<string>(),
  overridesAcknowledged: false,
  hasSelectedFlight: true,
  icaos: ["PANC", "PABE"],
  notamAckedIcaos: ["PANC", "PABE"],
};

describe("computeHardBlockReason", () => {
  it("returns null when nothing blocks", () => {
    expect(computeHardBlockReason(CLEAR)).toBeNull();
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
