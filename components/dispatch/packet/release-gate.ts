import type {
  PicComplianceResponse,
  ReleaseBlocker,
  RouteFreshness,
  WeatherMinimumsView,
} from "@/lib/api/types";
import type { ReleaseLoad } from "@/lib/api/manifest";
import { minimumsBlockReason } from "@/lib/frat/weather-minimums";

import { unacknowledgedNotamIcaos } from "./notam-acks";
import { seatWarnings } from "./soft-warning-ack-parser";

/**
 * The single Generate-PDF release gate.
 *
 * Returns every reason release is blocked, in the order below, or an
 * empty list when the dispatcher may generate the packet. The packet
 * lists them all under the release buttons (#134): it used to name only
 * the first, so a dispatcher found each of the others by clearing the one
 * before. `computeHardBlockReason` gives the first with a count of the
 * rest, for a button's tooltip.
 *
 * Rules, in order (ALL unsatisfied conditions block release):
 *
 *   0. No PIC on the flight's crew → block. The server takes the PIC
 *                           from the roster and refuses without one
 *                           (29 Sep): a release that named nobody used
 *                           to skip every PIC check.
 *   1. PIC currency RED   → block unless every hard block has a
 *                           supervisor override on record for this
 *                           flight (the PIC check's override_id): one a
 *                           Chief Pilot, DO or Exec Admin wrote for this
 *                           flight, pilot and item. The server applies
 *                           the same rule.
 *      SIC currency RED   → block. No override: the supervisor override
 *                           records PIC deviations, so the seat is
 *                           reassigned or the items cleared.
 *   2. Soft warnings      → block until every one, for either seat, is
 *                           ack'd (?warns_acked=..., the SIC's as
 *                           "sic:<code>"), whatever the dot colour.
 *   3. NOTAMs              → block until every routed ICAO is ack'd
 *                           (?notams_acked=...), enforcing the promise
 *                           the NOTAM panel makes on screen.
 *   4. Below the company's dispatch minimums, for an aircraft that is
 *                           not IFR certified (#89) → block. No
 *                           acknowledgment clears it; the server holds
 *                           it before the stale-weather gate, as here.
 *   5. Stale / missing weather → block until acknowledged
 *                           (?stale_wx_ack=1). Legacy orders this last
 *                           too (modules/dispatch/form.html), so a
 *                           dispatcher clears currency, then NOTAMs,
 *                           then weather.
 *
 * Enforcement depth differs, and it matters which is which:
 *
 *   All four are ALSO enforced by the backend release endpoint, so
 *   bypassing the UI still fails: currency per seat (the SIC read from
 *   the flight's crew, not from here), soft-warning acks (27 Sep; before
 *   that only this gate checked them, and Release dispatch skipped this
 *   gate), NOTAM acks for every stop (audit finding C1), and weather,
 *   where the server runs the same shared evaluator this gate read.
 */
export interface ReleaseGateInput {
  picCompliance: PicComplianceResponse | null;
  /** Everyone in the flight's SIC seat, checked for that seat. */
  sicCompliance?: PicComplianceResponse[];
  ackedWarnCodes: Set<string>;
  overridesAcknowledged: boolean;
  /** True when a flight is loaded — NOTAMs only gate a real release. */
  hasSelectedFlight: boolean;
  /** The flight's crew roster has a PIC. The page's `?pic=` alone does
   *  not count: the release reads the roster. */
  picAssigned: boolean;
  /** Routed ICAOs (explicit ?route= or the flight's origin+destination). */
  icaos: string[];
  notamAckedIcaos: string[];
  /** Verdict from weather-service `GET /route-freshness`. Null when the
   *  call failed — see the handling at the bottom of this function. */
  weatherFreshness: RouteFreshness | null;
  /** `?stale_wx_ack=1` — dispatcher ticked the weather acknowledgment. */
  staleWeatherAcknowledged: boolean;
  /** ops `GET /flights/{id}/weather-minimums` (#89). Null when the call
   *  failed: as for freshness, release still refuses server-side. */
  weatherMinimums?: WeatherMinimumsView | null;
  /** #155 — open MEL deferrals on the aircraft, and the ones this
   *  dispatcher acknowledged. */
  openMelIds?: string[];
  ackedMelIds?: string[];
  /** #155 — what the flight's FRAT still needs, in order. Null when it
   *  couldn't be read: release still refuses server-side. */
  fratBlockers?: ReleaseBlocker[] | null;
  /** #155 — the load the release is judged on. Null when unknown. */
  releaseLoad?: ReleaseLoad | null;
}

export function computeReleaseBlockers(input: ReleaseGateInput): string[] {
  const {
    picCompliance,
    sicCompliance = [],
    ackedWarnCodes,
    overridesAcknowledged,
    hasSelectedFlight,
    picAssigned,
    icaos,
    notamAckedIcaos,
    weatherFreshness,
    staleWeatherAcknowledged,
    weatherMinimums = null,
    openMelIds = [],
    ackedMelIds = [],
    fratBlockers = null,
    releaseLoad = null,
  } = input;

  const blockers: string[] = [];

  if (hasSelectedFlight && !picAssigned) {
    blockers.push("No PIC on this flight's crew — pick one in Flight Details before release.");
  }

  if (
    picCompliance &&
    picCompliance.dot_color === "red" &&
    !overridesAcknowledged
  ) {
    const n = picCompliance.hard_blocks.length;
    blockers.push(
      `PIC ${picCompliance.pilot.full_name} has ${n} hard-block currency item${n === 1 ? "" : "s"} — release blocked until cleared or overridden.`,
    );
  }

  for (const sic of sicCompliance) {
    if (sic.dot_color === "red") {
      const n = sic.hard_blocks.length;
      blockers.push(
        `SIC ${sic.pilot.full_name} has ${n} hard-block currency item${n === 1 ? "" : "s"} — assign a current SIC or clear them before release.`,
      );
    }
  }

  const warnings = seatWarnings([
    ...(picCompliance ? [{ seat: "pic" as const, compliance: picCompliance }] : []),
    ...sicCompliance.map((compliance) => ({ seat: "sic" as const, compliance })),
  ]);
  const unacked = warnings.filter((w) => !ackedWarnCodes.has(w.key));
  if (unacked.length > 0) {
    blockers.push(`${unacked.length} of ${warnings.length} soft warnings still need dispatcher acknowledgment.`);
  }

  if (hasSelectedFlight && icaos.length > 0) {
    const unackedIcaos = unacknowledgedNotamIcaos(icaos, notamAckedIcaos);
    if (unackedIcaos.length > 0) {
      blockers.push(
        `NOTAMs not acknowledged for ${unackedIcaos.join(", ")} — review each stop and check the box before release.`,
      );
    }
  }

  const belowMinimums = hasSelectedFlight ? minimumsBlockReason(weatherMinimums) : null;
  if (belowMinimums) blockers.push(belowMinimums);

  if (
    hasSelectedFlight &&
    weatherFreshness !== null &&
    weatherFreshness.acknowledgment_required &&
    !staleWeatherAcknowledged
  ) {
    const stations = weatherFreshness.stations_requiring_acknowledgment;
    const where = stations.length > 0 ? ` for ${stations.join(", ")}` : "";
    blockers.push(`Stale or missing weather${where} — review it and acknowledge before release.`);
  }

  if (hasSelectedFlight) {
    const unackedMels = openMelIds.filter((id) => !ackedMelIds.includes(id));
    if (unackedMels.length > 0) {
      blockers.push(
        `${unackedMels.length} open MEL item${unackedMels.length === 1 ? "" : "s"} still need${unackedMels.length === 1 ? "s" : ""} dispatcher acknowledgment.`,
      );
    }
  }

  // #155 — the FRAT, then the load. The server holds them last too.
  if (hasSelectedFlight && fratBlockers) {
    for (const blocker of fratBlockers) blockers.push(`FRAT: ${blocker.message}`);
  }
  if (hasSelectedFlight && releaseLoad) {
    const remaining = releaseLoad.remaining_lbs === null ? null : Number(releaseLoad.remaining_lbs);
    if (releaseLoad.useful_load_lbs === null) {
      blockers.push("The aircraft has no max payload on record, so the load can't be checked — set it in Settings → Fleet.");
    } else if (remaining !== null && remaining < 0) {
      const from = releaseLoad.basis === "manifest" ? "the manifest" : "the passengers and cargo typed on the flight";
      blockers.push(`Over the aircraft's useful load by ${Math.round(-remaining).toLocaleString("en-US")} lb, by ${from}.`);
    }
  }

  // A null verdict means the freshness call failed. We do NOT block on
  // it: this gate is the convenience half, and the release endpoint runs
  // the same evaluator server-side, so a dispatcher who proceeds gets a
  // 409 with the real reason rather than a silent bypass. Blocking here
  // instead would strand every release whenever weather-service blips,
  // for a check the server is already making.
  return blockers;
}

/** The first reason release is blocked, and how many more there are: a
 *  disabled button's tooltip. Null when nothing blocks. */
export function computeHardBlockReason(input: ReleaseGateInput): string | null {
  const [first, ...rest] = computeReleaseBlockers(input);
  if (first === undefined) return null;
  return rest.length > 0 ? `${first} (and ${rest.length} more)` : first;
}

/**
 * Every PIC hard block has a supervisor override on record for this
 * flight: the PIC check marks each covered block with `override_id`.
 * No hard blocks is not "overridden": there is nothing to override.
 */
export function overridesOnRecord(pic: PicComplianceResponse | null): boolean {
  const blocks = pic?.hard_blocks ?? [];
  return blocks.length > 0 && blocks.every((b) => Boolean(b.override_id));
}
