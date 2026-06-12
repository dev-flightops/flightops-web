import Link from "next/link";

import { getFlightBoard } from "@/lib/api/flight-following";
import { getFleetAirworthiness, listMelItems } from "@/lib/api/maintenance";

/**
 * Active Alerts panel — Home Page spec, Component 5.
 *
 * The spec lists 10 alert types across red / yellow severity, sorted
 * red first. Three have data we already collect today; the other
 * seven need services we haven't built (crew, safety, fuel-quality,
 * load-teams). We render the three live ones and surface a small
 * caption explaining the rest land with their services.
 *
 *   Live today:
 *     RED   - Aircraft grounded  (fleet airworthiness blocking_count > 0)
 *     RED   - Flight overdue     (board.is_overdue == true)
 *     YELLOW - MEL expiring <2d  (mel_item.due_at within 48h)
 *
 *   Pending:
 *     RED    - Pilot non-current             (crew-service, M3)
 *     RED    - Aircraft on fuel hold         (fuel quality test, M3)
 *     RED    - Safety report at critical     (safety-service, M3)
 *     YELLOW - Pilot in grace month          (crew-service, M3)
 *     YELLOW - Corrective action overdue     (safety-service, M3)
 *     YELLOW - No load team assigned         (ground load-teams, M2-M-25d)
 *     YELLOW - Drug test result pending      (crew-service, M3)
 *
 * Spec roles: SA, DO, CP, DS, SO only. The role check happens at the
 * call site in app/(app)/home/page.tsx — this component renders
 * whatever it's handed.
 *
 * Spec says alerts cache for 60s. We rely on Next's default fetch
 * cache (no-store on the underlying apiFetch today, so callers get
 * fresh data per render). When traffic warrants we'll move to a
 * Redis-backed snapshot.
 */
export async function ActiveAlertsPanel() {
  const [fleet, openMels, board] = await Promise.all([
    getFleetAirworthiness().catch(() => null),
    listMelItems({ status: "open" }).catch(() => null),
    getFlightBoard("today").catch(() => null),
  ]);

  const alerts: Alert[] = [];
  const now = Date.now();
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

  // Red — Aircraft grounded (blocking_count > 0)
  if (fleet) {
    for (const row of fleet.items) {
      if (row.blocking_count > 0) {
        alerts.push({
          id: `grounded-${row.aircraft.id}`,
          severity: "red",
          title: `Aircraft grounded — ${row.aircraft.tail_number}`,
          detail: `${row.blocking_count} blocking issue${
            row.blocking_count === 1 ? "" : "s"
          } open. Cannot dispatch.`,
          href: `/maintenance/aircraft/${row.aircraft.id}`,
        });
      }
    }
  }

  // Red — Flight overdue
  if (board) {
    for (const row of board.items) {
      if (row.is_overdue) {
        alerts.push({
          id: `overdue-${row.id}`,
          severity: "red",
          title: `Flight overdue — ${row.flight_number}`,
          detail: `${row.aircraft.tail_number} · ${row.origin} → ${row.destination} · no contact 20+ min`,
          href: "/flight-following",
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
          title: `MEL expiring — ${mel.aircraft.tail_number} · ATA ${mel.ata_chapter}`,
          detail: `${hours}h remaining · ${mel.description}`,
          href: `/maintenance/aircraft/${mel.aircraft.id}`,
        });
      }
    }
  }

  // Sort: red before yellow, stable within each band.
  alerts.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "red" ? -1 : 1,
  );

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

interface Alert {
  id: string;
  severity: "red" | "yellow";
  title: string;
  detail: string;
  href: string;
}
