import { listDayLoads } from "@/lib/api/ground";
import { listSquawks, listWorkOrders } from "@/lib/api/maintenance";
import { listMyHandoffs } from "@/lib/api/ops";
import { handoffLine } from "@/lib/flights/handoff-text";
import { formatLocal } from "@/lib/format/flight-time";
import {
  AIRWORTHINESS_WRITERS,
  DISPATCH_WRITERS,
  HANDOFF_VIEWERS,
  WORK_ORDER_WRITERS,
  hasAnyRole,
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
 */

const NEW_SQUAWK_MS = 2 * 24 * 60 * 60 * 1000;

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
