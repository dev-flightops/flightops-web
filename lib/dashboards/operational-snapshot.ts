/**
 * Shared "operational snapshot" — one fetch fan-out, reused across the
 * home page Active Alerts panel + every dashboard that needs the same
 * live operational picture (Executive, Director Ops, Dispatcher,
 * Station).
 *
 * Centralizing the fetch means:
 *   - one source of truth for "what's wrong right now"
 *   - per-dashboard pages don't each re-derive the same alerts from
 *     scratch (and risk drift)
 *   - swapping the real /alerts service in (M3) is a one-line change
 *
 * Spec sources used today:
 *   - getFleetAirworthiness()      — blocking_count > 0  → grounded
 *                                    aircraft_active counts → KPI
 *   - getFlightBoard("today")      — is_overdue          → overdue flights
 *                                    status flags        → released / airborne
 *                                    origin / destination → base breakdowns
 *   - listMelItems({status:open})  — due_at < now+48h    → MEL expiring
 *
 * Spec sources NOT used (need M3+ services):
 *   pilot_currency_records, safety_reports, corrective_actions,
 *   compliance_overrides, fuel quality tests, village weather board.
 */

import { getFlightBoard } from "@/lib/api/flight-following";
import { getFleetAirworthiness, listMelItems } from "@/lib/api/maintenance";
import type {
  BoardFlightItem,
  FleetAircraftSummary,
} from "@/lib/api/types";

export interface OperationalAlert {
  id: string;
  severity: "red" | "yellow";
  /** Stable category — useful for grouping or future filtering. */
  category:
    | "aircraft_grounded"
    | "flight_overdue"
    | "mel_expiring";
  title: string;
  detail: string;
  /** Permalink to the source record. */
  href: string;
  /** Optional ICAO scope — used by Station dashboard to filter to base. */
  scopedToIcao?: string;
}

export interface OperationalSnapshot {
  /** Sorted red → yellow. */
  alerts: OperationalAlert[];
  airborneCount: number;
  releasedCount: number;
  fleetTotal: number;
  fleetAirworthy: number;
  fleetGrounded: number;
  /** Per-base counts derived from board.origin. */
  flightsByOrigin: Map<string, BoardFlightItem[]>;
  /** Raw board for callers that need more than the aggregates. */
  board: BoardFlightItem[];
  /** Raw fleet rows. */
  fleet: FleetAircraftSummary[];
}

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export async function loadOperationalSnapshot(): Promise<OperationalSnapshot> {
  const [fleet, openMels, board] = await Promise.all([
    getFleetAirworthiness().catch(() => null),
    listMelItems({ status: "open" }).catch(() => null),
    getFlightBoard("today").catch(() => null),
  ]);

  const alerts: OperationalAlert[] = [];
  const now = Date.now();

  // Red — grounded
  if (fleet) {
    for (const row of fleet.items) {
      if (row.blocking_count > 0) {
        alerts.push({
          id: `grounded-${row.aircraft.id}`,
          severity: "red",
          category: "aircraft_grounded",
          title: `Aircraft grounded — ${row.aircraft.tail_number}`,
          detail: `${row.blocking_count} blocking issue${
            row.blocking_count === 1 ? "" : "s"
          } open. Cannot dispatch.`,
          href: `/maintenance/aircraft/${row.aircraft.id}`,
        });
      }
    }
  }

  // Red — overdue
  if (board) {
    for (const row of board.items) {
      if (row.is_overdue) {
        alerts.push({
          id: `overdue-${row.id}`,
          severity: "red",
          category: "flight_overdue",
          title: `Flight overdue — ${row.flight_number}`,
          detail: `${row.aircraft.tail_number} · ${row.origin} → ${row.destination} · no contact 20+ min`,
          href: "/flight-following",
          scopedToIcao: row.origin,
        });
      }
    }
  }

  // Yellow — MEL expiring within 2 days
  if (openMels) {
    for (const mel of openMels.items) {
      const dueMs = new Date(mel.due_at).getTime();
      const remainingMs = dueMs - now;
      if (remainingMs > 0 && remainingMs < TWO_DAYS_MS) {
        const hours = Math.floor(remainingMs / (60 * 60 * 1000));
        alerts.push({
          id: `mel-soon-${mel.id}`,
          severity: "yellow",
          category: "mel_expiring",
          title: `MEL expiring — ${mel.aircraft.tail_number} · ATA ${mel.ata_chapter}`,
          detail: `${hours}h remaining · ${mel.description}`,
          href: `/maintenance/aircraft/${mel.aircraft.id}`,
        });
      }
    }
  }

  alerts.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "red" ? -1 : 1,
  );

  const boardItems = board?.items ?? [];
  let airborneCount = 0;
  let releasedCount = 0;
  const flightsByOrigin = new Map<string, BoardFlightItem[]>();
  for (const row of boardItems) {
    if (row.status === "released") {
      releasedCount += 1;
      // "Airborne" inferred from released + actual_departure_at set —
      // legacy uses an explicit airborne status that we collapse into
      // released until the check-in flow records ATD.
      if (row.actual_departure_at) airborneCount += 1;
    }
    const list = flightsByOrigin.get(row.origin) ?? [];
    list.push(row);
    flightsByOrigin.set(row.origin, list);
  }

  const fleetRows = fleet?.items ?? [];
  const fleetTotal = fleetRows.filter((r) => r.is_active).length;
  const fleetAirworthy = fleetRows.filter(
    (r) => r.is_active && r.is_airworthy,
  ).length;
  const fleetGrounded = fleetRows.filter(
    (r) => r.is_active && !r.is_airworthy,
  ).length;

  return {
    alerts,
    airborneCount,
    releasedCount,
    fleetTotal,
    fleetAirworthy,
    fleetGrounded,
    flightsByOrigin,
    board: boardItems,
    fleet: fleetRows,
  };
}

/** Scope an existing snapshot to one ICAO — used by the Station
 *  dashboard so it can show alerts + flights + aircraft scoped to its
 *  base without re-fetching. */
export function scopeSnapshotToIcao(
  snap: OperationalSnapshot,
  icao: string,
): {
  alerts: OperationalAlert[];
  flightsAtBase: BoardFlightItem[];
} {
  const normalized = icao.trim().toUpperCase();
  return {
    alerts: snap.alerts.filter(
      (a) => !a.scopedToIcao || a.scopedToIcao === normalized,
    ),
    flightsAtBase: snap.board.filter(
      (f) => f.origin === normalized || f.destination === normalized,
    ),
  };
}
