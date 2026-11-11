import { alertIsFor } from "@/lib/alerts/audience";
import { listAlertAcknowledgments } from "@/lib/api/ops";

import {
  applyDismissals,
  type DismissalOutcome,
} from "./alert-dismissal";
import {
  loadOperationalSnapshot,
  type OperationalAlert,
} from "./operational-snapshot";
import { loadPersonalAlerts } from "./personal-alerts";

/**
 * The alerts this user has not yet dealt with.
 *
 * One function, used by the top-bar bell. Deliberately thin: the alerts
 * come from `loadOperationalSnapshot()` — the same derivation the home
 * page and four dashboards use — and all this adds is the per-user
 * dismissal filter.
 *
 * WHY THE FILTER COMPARES TIMESTAMPS RATHER THAN JUST KEYS
 *
 * Alert ids are stable per underlying record, which is what makes them
 * dismissable. It is also a trap: ground an aircraft, dismiss the
 * alert, return it to service, ground it again, and the id is
 * identical. Matching on the key alone would hide the second grounding
 * for as long as the row survived.
 *
 * So a dismissal covers an *occurrence*. An alert is hidden only while
 * the dismissal is at or after the alert's own onset.
 *
 * WHY A FAILED ACKNOWLEDGMENT FETCH SHOWS EVERYTHING
 *
 * If ops-service is unreachable the bell shows the unfiltered list
 * rather than an empty one. Failing towards "you have things to look
 * at" is the safe direction for an alert surface: the cost is a
 * dismissed alert reappearing, and the alternative is an operational
 * alert silently not being shown.
 */

export type UnacknowledgedAlerts = DismissalOutcome<OperationalAlert>;

export async function loadUnacknowledgedAlerts(
  /** Adds the viewer's own alerts (#134): a new squawk for maintenance,
   *  a load complete for the flight's crew and dispatch. */
  viewer?: { roles: readonly string[]; userId: string | null },
): Promise<UnacknowledgedAlerts> {
  const [snapshot, personal, acks] = await Promise.all([
    loadOperationalSnapshot(),
    viewer ? loadPersonalAlerts(viewer).catch(() => []) : [],
    listAlertAcknowledgments().catch(() => null),
  ]);
  // Each of the operation's alerts goes to the roles that act on it (LOG-42).
  const operation = viewer ? snapshot.alerts.filter((a) => alertIsFor(a, viewer.roles)) : snapshot.alerts;
  return applyDismissals(
    [...operation.filter((a) => a.severity === "red"), ...personal.filter((a) => a.severity === "red"),
     ...operation.filter((a) => a.severity !== "red"), ...personal.filter((a) => a.severity !== "red")],
    acks === null ? null : new Map(acks.map((a) => [a.alert_key, a])),
  );
}
