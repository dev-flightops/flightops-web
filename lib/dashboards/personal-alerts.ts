import { loadZoneTable } from "@/lib/api/auth";
import { getFlightBoard } from "@/lib/api/flight-following";
import { listDayLoads, listFuelOrders, listMyLoadTeams } from "@/lib/api/ground";
import { listSquawks, listWorkOrders } from "@/lib/api/maintenance";
import { listMyHandoffs } from "@/lib/api/ops";
import type { FlightAssignmentResponse } from "@/lib/api/types";
import { handoffLine } from "@/lib/flights/handoff-text";
import { formatLocal } from "@/lib/format/flight-time";
import { localClock, localDay, zoneFor } from "@/lib/format/local-time";
import {
  AIRWORTHINESS_WRITERS,
  DISPATCH_WRITERS,
  HANDOFF_VIEWERS,
  WORK_ORDER_WRITERS,
  hasAnyRole,
  roleGate,
} from "@/lib/roles";

import type { OperationalAlert } from "./operational-snapshot";

/**
 * The bell's alerts for one person (#134), beside the operation's: the
 * client's day has each handoff told to whoever acts next.
 *
 *   - A pilot's squawk tells maintenance: "when you squawk the plane, it
 *     tells maintenance and maintenance opens up a file". Until a work
 *     order is opened for it, to whoever may open one.
 *   - The load team's "load complete" tells the pilot and dispatch: "as
 *     a pilot, we're looking at fuel complete, load complete, passengers
 *     checked in". To the flight's crew and to dispatch, until it departs.
 *   - The hand-offs between dispatch and the pilot (#175): "notify the next
 *     party in the flow that their is an item that needs action". Worked
 *     out by ops for the person asking (GET /ops/handoffs), to everyone.
 *   - The ramp's (LOG-42): "Ramp sees departures and fuel orders at its
 *     station". Its stations are its load teams' bases, or every station
 *     for someone on no team; an order the supplier fuels is the
 *     supplier's.
 */

const NEW_SQUAWK_MS = 2 * 24 * 60 * 60 * 1000;
const MINUTE = 60_000;
/** A departure is the ramp's news from an hour out until an hour late. */
const DEPARTING_SOON_MS = 60 * MINUTE;
const RAMP = roleGate("ground_ops");

export async function loadPersonalAlerts(viewer: {
  roles: readonly string[];
  userId: string | null;
}): Promise<OperationalAlert[]> {
  const mx = hasAnyRole(viewer.roles, WORK_ORDER_WRITERS) || hasAnyRole(viewer.roles, AIRWORTHINESS_WRITERS);
  const dispatch = hasAnyRole(viewer.roles, DISPATCH_WRITERS);
  const [squawks, orders, loads, handoffs] = await Promise.all([
    mx ? listSquawks({ status: "open", limit: 50 }).catch(() => null) : null,
    mx ? listWorkOrders().catch(() => null) : null,
    dispatch || viewer.userId ? listDayLoads().catch(() => null) : null,
    hasAnyRole(viewer.roles, HANDOFF_VIEWERS) ? listMyHandoffs().catch(() => null) : null,
  ]);
  const alerts: OperationalAlert[] = [];
  const now = Date.now();

  if (squawks && orders) {
    const worked = new Set(orders.items.map((o) => o.squawk_id).filter(Boolean));
    for (const sq of squawks.items) {
      if (worked.has(sq.id) || now - Date.parse(sq.reported_at) > NEW_SQUAWK_MS) continue;
      alerts.push({
        id: `squawk-${sq.id}`,
        severity: sq.severity === "grounding" ? "red" : "yellow",
        category: "squawk_new",
        title: `New squawk — ${sq.aircraft.tail_number}`,
        detail: `${sq.title} · ${sq.severity} · ${sq.reported_by.full_name}. Open a work order.`,
        href: `/maintenance/work-orders/new?squawk=${sq.id}`,
        occurredAt: sq.reported_at,
      });
    }
  }

  if (loads) {
    for (const a of loads.items) {
      if (!a.load_completed_at || a.flight.status === "completed" || a.flight.status === "cancelled") continue;
      const crew = viewer.userId !== null && (a.crew_user_ids ?? []).includes(viewer.userId);
      if (!crew && !dispatch) continue;
      alerts.push({
        id: `load-${a.id}`,
        severity: "yellow",
        category: "load_complete",
        title: `Load complete — ${a.flight.flight_number}`,
        detail: `${a.load_team.team_name}${a.load_completed_by ? `, ${a.load_completed_by.full_name}` : ""} at ${formatLocal(a.load_completed_at)}${
          a.photo_count ? ` · ${a.photo_count === 1 ? "1 photo" : `${a.photo_count} photos`}` : ""
        }.`,
        href: crew ? `/flight-crew/preflight/${a.flight.id}` : `/dispatch?flight=${a.flight.id}`,
        occurredAt: a.load_completed_at,
      });
    }
  }

  if (hasAnyRole(viewer.roles, RAMP)) alerts.push(...(await rampAlerts(loads?.items ?? [], now)));

  for (const item of handoffs?.items ?? []) {
    const line = handoffLine(item);
    alerts.push({
      // Each turn is its own occurrence: a FRAT signed again, or a second
      // release, comes back after a dismissal.
      id: `handoff-${item.kind}-${item.turn}-${item.flight_id}`,
      severity: line.severity,
      category: "handoff",
      title: line.title,
      detail: line.detail,
      href: line.href,
      scopedToIcao: item.origin,
      occurredAt: item.occurred_at,
    });
  }
  return alerts;
}

function loadWords(load: FlightAssignmentResponse | undefined, zone: string): string {
  if (!load) return "No load team on it yet.";
  if (load.load_started_at) return `${load.load_team.team_name} loading since ${localClock(load.load_started_at, zone)}.`;
  if (load.acknowledged_at) return `${load.load_team.team_name} acknowledged it, loading not started.`;
  return `${load.load_team.team_name} hasn't acknowledged it.`;
}

async function rampAlerts(loads: FlightAssignmentResponse[], now: number): Promise<OperationalAlert[]> {
  const [teams, board, ordered, confirmed, zones] = await Promise.all([
    listMyLoadTeams().catch(() => null),
    getFlightBoard("today").catch(() => null),
    listFuelOrders({ status: "ordered", limit: 100 }).catch(() => null),
    listFuelOrders({ status: "confirmed", limit: 100 }).catch(() => null),
    loadZoneTable(),
  ]);
  const stations = teams && teams.items.length > 0 ? new Set(teams.items.map((t) => t.base_icao)) : null;
  const atMine = (icao: string) => stations === null || stations.has(icao);
  const loadFor = new Map(loads.map((a) => [a.flight.id, a]));
  const alerts: OperationalAlert[] = [];

  for (const f of board?.items ?? []) {
    if (!atMine(f.origin) || f.actual_departure_at || (f.status !== "scheduled" && f.status !== "released")) continue;
    const departs = Date.parse(f.scheduled_departure_at);
    if (Math.abs(departs - now) > DEPARTING_SOON_MS) continue;
    const load = loadFor.get(f.id);
    if (load?.load_completed_at) continue;
    const zone = zoneFor(zones, f.origin);
    alerts.push({
      id: `departing-${f.id}`,
      severity: departs - now <= 15 * MINUTE ? "red" : "yellow",
      category: "departure_soon",
      title: `Departing ${localClock(f.scheduled_departure_at, zone)} — ${f.flight_number}`,
      detail: `${f.aircraft.tail_number}, ${f.origin} → ${f.destination}. ${loadWords(load, zone)}`,
      href: "/ramper",
      scopedToIcao: f.origin,
      occurredAt: f.scheduled_departure_at,
    });
  }

  const today = localDay(zones.fallback);
  for (const o of [...(ordered?.items ?? []), ...(confirmed?.items ?? [])]) {
    if (o.supplier?.fueled_by === "supplier" || !atMine(o.base_code) || o.requested_fuel_date !== today) continue;
    const toConfirm = o.status === "ordered";
    const zone = zoneFor(zones, o.base_code);
    alerts.push({
      // Confirming it is a new occurrence: "to put in" comes back after
      // "to confirm" was dismissed.
      id: `fuel-${o.id}`,
      severity: "yellow",
      category: "fuel_order",
      title: `${toConfirm ? "Fuel to confirm" : "Fuel to put in"} — ${o.n_number} at ${o.base_code}`,
      detail: `${o.requested_quantity_gallons} gal ${o.fuel_type_label_snapshot}, ${o.supplier_name_snapshot}${
        o.requested_fuel_time ? `, by ${localClock(o.requested_fuel_time, zone)}` : ""
      }.`,
      href: "/ramper",
      scopedToIcao: o.base_code,
      occurredAt: toConfirm ? o.requested_at : (o.confirmed_at ?? o.requested_at),
    });
  }
  return alerts;
}
