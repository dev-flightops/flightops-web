import type { PicComplianceResponse } from "@/lib/api/types";

import { unacknowledgedNotamIcaos } from "./notam-acks";

/**
 * The single Generate-PDF release gate.
 *
 * Returns the reason release is blocked, or null when the dispatcher may
 * generate the packet. The dispatch page passes the result straight to
 * GeneratePdfButton's `hardBlockReason`.
 *
 * Rules, in precedence order (only one reason surfaces — there's one
 * tooltip slot — but ALL unsatisfied conditions block release):
 *
 *   1. PIC currency RED   → block unless a supervisor override was
 *                           recorded (?overrides_ack=1).
 *   2. PIC currency YELLOW → block until every soft warning is ack'd
 *                           (?warns_acked=...).
 *   3. NOTAMs              → block until every routed ICAO is ack'd
 *                           (?notams_acked=...), enforcing the promise
 *                           the NOTAM panel makes on screen.
 *
 * Enforcement depth differs: (1) and (2) are also enforced by the backend
 * release endpoint, so bypassing the UI still fails. (3) is UI-only today
 * — NOTAM ack state never reaches the release call — so it is a
 * dispatcher-workflow guard, not a server-side control. Backend NOTAM
 * enforcement is a tracked follow-up.
 */
export function computeHardBlockReason(input: {
  picCompliance: PicComplianceResponse | null;
  ackedWarnCodes: Set<string>;
  overridesAcknowledged: boolean;
  /** True when a flight is loaded — NOTAMs only gate a real release. */
  hasSelectedFlight: boolean;
  /** Routed ICAOs (explicit ?route= or the flight's origin+destination). */
  icaos: string[];
  notamAckedIcaos: string[];
}): string | null {
  const {
    picCompliance,
    ackedWarnCodes,
    overridesAcknowledged,
    hasSelectedFlight,
    icaos,
    notamAckedIcaos,
  } = input;

  if (
    picCompliance &&
    picCompliance.dot_color === "red" &&
    !overridesAcknowledged
  ) {
    const n = picCompliance.hard_blocks.length;
    return `PIC ${picCompliance.pilot.full_name} has ${n} hard-block currency item${n === 1 ? "" : "s"} — release blocked until cleared or overridden.`;
  }

  if (picCompliance && picCompliance.dot_color === "yellow") {
    const unacked = picCompliance.soft_warnings.filter(
      (w) => !ackedWarnCodes.has(w.code),
    );
    if (unacked.length > 0) {
      return `${unacked.length} of ${picCompliance.soft_warnings.length} soft warnings still need dispatcher acknowledgment.`;
    }
  }

  if (hasSelectedFlight && icaos.length > 0) {
    const unackedIcaos = unacknowledgedNotamIcaos(icaos, notamAckedIcaos);
    if (unackedIcaos.length > 0) {
      return `NOTAMs not acknowledged for ${unackedIcaos.join(", ")} — review each stop and check the box before release.`;
    }
  }

  return null;
}
