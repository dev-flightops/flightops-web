import { listAlertAcknowledgments } from "@/lib/api/ops";

import {
  applyDismissals,
  type DismissalOutcome,
} from "./alert-dismissal";
import {
  loadOperationalSnapshot,
  type OperationalAlert,
} from "./operational-snapshot";

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

export async function loadUnacknowledgedAlerts(): Promise<UnacknowledgedAlerts> {
  const [snapshot, acks] = await Promise.all([
    loadOperationalSnapshot(),
    listAlertAcknowledgments().catch(() => null),
  ]);
  return applyDismissals(
    snapshot.alerts,
    acks === null ? null : new Map(acks.map((a) => [a.alert_key, a])),
  );
}
