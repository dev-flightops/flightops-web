import { describe, expect, it } from "vitest";

import type { HandoffItem } from "@/lib/api/types";

import { handoffLine } from "./handoff-text";

const item = (over: Partial<HandoffItem> = {}): HandoffItem => ({
  kind: "frat_to_sign",
  turn: "dispatch",
  flight_id: "f-1",
  flight_number: "CH742",
  origin: "PABE",
  destination: "PABE",
  stops: ["PABE", "PACM", "PABE"],
  scheduled_departure_at: "2026-11-17T20:30:00Z",
  occurred_at: "2026-11-17T18:20:00Z",
  by_name: "Tomas Pilot",
  filed_by_pilot: false,
  refiled: false,
  note: null,
  ...over,
});

/**
 * 17 Nov: the pilot's change carries their signature; dispatch is told
 * what changed and signs again, and the pilot isn't asked a second time.
 * A change dispatch makes after the pilot signed is told to the pilot.
 */
describe("the FRAT hand-offs say what changed (17 Nov)", () => {
  it("tells dispatch what the pilot changed, and no longer that the pilot signs after", () => {
    const line = handoffLine(
      item({
        filed_by_pilot: true,
        refiled: true,
        changes: [
          { code: "wx_wind", before: 0, after: 2 },
          { code: "pilot_rest", before: 1, after: 3 },
        ],
        mitigations_changed: true,
      }),
    );
    expect(line.title).toBe("FRAT changed by the pilot — CH742");
    expect(line.detail).toMatch(
      /Tomas Pilot changed it at .+: Rest in last 24h 1 → 3, Wind & gusts 0 → 2, and the mitigation\. Review the changes and sign it again\.$/,
    );
    expect(line.detail).not.toMatch(/then the pilot signs/);
    expect(line.href).toBe("/frat/f-1");
  });

  it("asks dispatch to review a FRAT the pilot filed first", () => {
    const line = handoffLine(item({ filed_by_pilot: true }));
    expect(line.title).toBe("Sign the FRAT — CH742");
    expect(line.detail).toMatch(/Tomas Pilot filed it at .+\. Review it and sign it\.$/);
  });

  it("tells the pilot what dispatch changed since they signed", () => {
    const line = handoffLine(
      item({ turn: "pilot", by_name: "Dana Dispatch", changes: [{ code: "wx_wind", before: 2, after: 4 }] }),
    );
    expect(line.title).toBe("Sign the FRAT — CH742");
    expect(line.detail).toMatch(
      /Dana Dispatch changed it at .+: Wind & gusts 2 → 4\. Review it and sign it again at preflight step 1\.$/,
    );
    expect(line.href).toBe("/flight-crew/preflight/f-1");
  });

  it("says as before when nothing is listed", () => {
    expect(handoffLine(item({ turn: "pilot", by_name: "Dana Dispatch" })).detail).toMatch(
      /Dana Dispatch scored and signed it at .+\. Review it and sign it at preflight step 1\.$/,
    );
  });
});

describe("a FRAT waiting on the Chief Pilot or DO (#152)", () => {
  it("asks them to accept a FRAT over company limits, on its page", () => {
    const line = handoffLine(item({ kind: "frat_to_accept", turn: "chief_pilot_or_do", note: "over_limits" }));
    expect(line.title).toBe("Accept the FRAT — CH742");
    expect(line.detail).toMatch(/Over company limits\. Signed by dispatch and Tomas Pilot at .+; accept it with a reason before it can be released\.$/);
    expect(line.href).toBe("/frat/f-1");
    expect(line.severity).toBe("red");
  });

  it("asks them to approve a HIGH one", () => {
    const line = handoffLine(item({ kind: "frat_to_accept", turn: "chief_pilot_or_do", note: "high_risk" }));
    expect(line.detail).toMatch(/The packet rates it HIGH\..+approve it with a reason before it can be released\.$/);
  });
});
