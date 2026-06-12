import Link from "next/link";

import {
  loadOperationalSnapshot,
  type OperationalAlert,
} from "@/lib/dashboards/operational-snapshot";

/**
 * Active Alerts panel — Home Page spec, Component 5.
 *
 * Data source is the shared loadOperationalSnapshot(), which is also
 * consumed by the Executive / DO / Dispatcher / Station dashboards.
 * One source = no drift between Home and the dashboards.
 *
 * The spec lists 10 alert types; three of them are wired today
 * (aircraft grounded / flight overdue / MEL expiring <2d). The other
 * seven need services we haven't built — the caption notes that.
 *
 * Role gate happens at the call site in app/(app)/home/page.tsx.
 */
export async function ActiveAlertsPanel() {
  const snap = await loadOperationalSnapshot();

  return <AlertsList alerts={snap.alerts} />;
}

function AlertsList({ alerts }: { alerts: OperationalAlert[] }) {
  return (
    <section className="mb-6 rounded-lg border border-border bg-card p-4">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide">Active alerts</h2>
        <span className="text-[0.65rem] text-muted-foreground">
          {alerts.length} live · 7 more land with their services (M3 / M2-M-25d)
        </span>
      </header>

      {alerts.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-card/40 px-4 py-6 text-center text-xs text-muted-foreground">
          No active alerts from the wired sources. The fleet is airworthy,
          no flights are overdue, and no MELs expire in the next 48 hours.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {alerts.map((a) => (
            <li key={a.id}>
              <Link
                href={a.href}
                className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors hover:bg-card/80 ${
                  a.severity === "red"
                    ? "border-status-red/40 bg-status-red/[0.06] text-foreground"
                    : "border-status-yellow/40 bg-status-yellow/[0.06] text-foreground"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={
                      a.severity === "red"
                        ? "text-status-red"
                        : "text-status-yellow"
                    }
                  >
                    ●
                  </span>
                  <span>
                    <span className="font-semibold">{a.title}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {a.detail}
                    </span>
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
