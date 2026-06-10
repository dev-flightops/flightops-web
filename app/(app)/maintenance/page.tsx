import { FleetCard } from "@/components/maintenance/fleet-card";
import { ApiError } from "@/lib/api/client";
import { getFleetAirworthiness } from "@/lib/api/maintenance";
import type { FleetAircraftSummary } from "@/lib/api/types";

/**
 * /maintenance — Maintenance landing (M2-G-19).
 *
 * One card per aircraft in the tenant with the airworthiness verdict
 * + open MEL/squawk counts (from the M2-M-16 bulk endpoint). Sorted
 * server-side by tail number. Grounded aircraft surface first via
 * red border treatment; advisory state gets yellow; clean stays
 * muted. Inactive tails fade to 60% so retired aircraft are visible
 * but don't compete with the active fleet for attention.
 *
 * Future stories (M2-G-20+) replace the "Details →" link target with
 * the real per-aircraft maintenance detail page; for now the URL is
 * provisional and the link 404s.
 */
export default async function MaintenanceLandingPage() {
  let items: FleetAircraftSummary[] = [];
  let loadError: string | null = null;

  try {
    items = (await getFleetAirworthiness()).items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Maintenance feed unavailable. Try refreshing in a moment.";
  }

  const grounded = items.filter(
    (a) => !a.is_airworthy || a.blocking_count > 0,
  ).length;
  const advisory = items.filter(
    (a) => a.is_airworthy && a.advisory_count > 0,
  ).length;
  const clean = items.length - grounded - advisory;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Fleet Maintenance
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Airworthiness verdict + open work per aircraft. Updated on
            page load.
          </p>
        </div>
        {items.length > 0 && (
          <div className="flex gap-2 text-[0.65rem] uppercase tracking-[0.08em]">
            <Summary label="Grounded" value={grounded} tone="red" />
            <Summary label="Advisory" value={advisory} tone="yellow" />
            <Summary label="Airworthy" value={clean} tone="green" />
          </div>
        )}
      </header>

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-16 text-center">
          <div className="mb-3 text-3xl opacity-20" aria-hidden>
            &#9874;
          </div>
          <p className="text-sm text-muted-foreground">
            No aircraft in this tenant&apos;s fleet yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((summary) => (
            <FleetCard key={summary.aircraft.id} summary={summary} />
          ))}
        </div>
      )}
    </div>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "red" | "yellow" | "green";
}) {
  const toneClass = {
    red: "bg-status-red/15 text-status-red",
    yellow: "bg-status-yellow/15 text-status-yellow",
    green: "bg-status-green/15 text-status-green",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-1 font-semibold ${toneClass}`}
    >
      <span className="font-mono text-sm font-bold tabular-nums">{value}</span>
      <span>{label}</span>
    </span>
  );
}
