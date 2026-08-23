import { loadOperationalSnapshot } from "@/lib/dashboards/operational-snapshot";

import { AlertsList } from "./alerts-list";

/**
 * Active Alerts panel — Home Page spec, Component 5.
 *
 * Data source is the shared loadOperationalSnapshot(), also consumed by
 * the Executive / DO / Dispatcher / Station dashboards. One source = no
 * drift between Home and the dashboards.
 *
 * The spec lists 10 alert types; three are wired today (aircraft
 * grounded / flight overdue / MEL expiring <2d). The rest need services
 * that do not exist yet, which the caption says.
 *
 * Role gate happens at the call site in app/(app)/home/page.tsx.
 *
 * Rendering lives in alerts-list.tsx — see that file for why it is
 * split out and how the grouping works.
 */
export async function ActiveAlertsPanel() {
  const snap = await loadOperationalSnapshot();
  return <AlertsList alerts={snap.alerts} />;
}

