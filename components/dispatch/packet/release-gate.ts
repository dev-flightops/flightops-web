import type { PicComplianceResponse, RouteFreshness } from "@/lib/api/types";

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
 *   4. Stale / missing weather → block until acknowledged
 *                           (?stale_wx_ack=1). Legacy orders this last
 *                           too (modules/dispatch/form.html), so a
 *                           dispatcher clears currency, then NOTAMs,
 *                           then weather.
 *
 * Enforcement depth differs, and it matters which is which:
 *
 *   (1), (2) and (4) are ALSO enforced by the backend release endpoint,
 *   so bypassing the UI still fails. For (4) the server runs the same
 *   shared evaluator this gate's input came from, so the two cannot
 *   disagree about whether an ack is needed.
 *
 *   (3) is UI-only today — NOTAM ack state never reaches the release
 *   call — so it is a dispatcher-workflow guard, not a server-side
 *   control. Backend NOTAM enforcement is a tracked follow-up.
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
  /** Verdict from weather-service `GET /route-freshness`. Null when the
   *  call failed — see the handling at the bottom of this function. */
  weatherFreshness: RouteFreshness | null;
  /** `?stale_wx_ack=1` — dispatcher ticked the weather acknowledgment. */
  staleWeatherAcknowledged: boolean;
}): string | null {
  const {
    picCompliance,
    ackedWarnCodes,
    overridesAcknowledged,
    hasSelectedFlight,
    icaos,
    notamAckedIcaos,
    weatherFreshness,
    staleWeatherAcknowledged,
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

  if (
    hasSelectedFlight &&
    weatherFreshness !== null &&
    weatherFreshness.acknowledgment_required &&
    !staleWeatherAcknowledged
  ) {
    const stations = weatherFreshness.stations_requiring_acknowledgment;
    const where = stations.length > 0 ? ` for ${stations.join(", ")}` : "";
    return `Stale or missing weather${where} — review it and acknowledge before release.`;
  }

  // A null verdict means the freshness call failed. We do NOT block on
  // it: this gate is the convenience half, and the release endpoint runs
  // the same evaluator server-side, so a dispatcher who proceeds gets a
  // 409 with the real reason rather than a silent bypass. Blocking here
  // instead would strand every release whenever weather-service blips,
  // for a check the server is already making.
  return null;
}
