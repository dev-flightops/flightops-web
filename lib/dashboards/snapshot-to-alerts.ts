/**
 * Adapter from the operational-snapshot's OperationalAlert shape to the
 * dashboards/<AlertList /> component's AlertItem shape.
 *
 * The two shapes diverged historically: dashboards/AlertList existed
 * first with severity `critical | warning | info`, and the new shared
 * snapshot uses `red | yellow` per the formal spec. Mapping in one
 * place so each dashboard call site stays a one-liner.
 */

import type { AlertItem } from "@/components/dashboards/alert-list";
import type { OperationalAlert } from "./operational-snapshot";

export function snapshotAlertsToList(
  alerts: OperationalAlert[],
): AlertItem[] {
  return alerts.map((a) => ({
    severity: a.severity === "red" ? "critical" : "warning",
    message: a.title,
    detail: a.detail,
    href: a.href,
    linkLabel: a.severity === "red" ? "open" : "review",
  }));
}
