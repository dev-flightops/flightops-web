import { ApiError } from "@/lib/api/client";
import { listHazards, listIncidents } from "@/lib/api/safety";
import type { HazardReport, Incident } from "@/lib/api/safety";

import { AnalysisPanel } from "./analysis-panel";
import {
  humanise,
  locationOf,
  openCount,
  tally,
  withinWindow,
  type Report,
} from "./report-stats";

/**
 * /ai/safety-intelligence — pattern analysis over the reporting window.
 *
 * Legacy's route and layout (`templates/ai/safety_intelligence.html`):
 * counts across the top, reports-by-type and top-locations beneath,
 * and the AI analysis below that, run on demand.
 *
 * The split matters more than it looks. The counts and the two
 * breakdown panels are arithmetic over your own reports — this page
 * computes them and they are exact. Everything under "Run AI Analysis"
 * is a model reading those reports and offering an opinion. Keeping
 * them visually apart is the point: a reader should never have to
 * wonder which half they are looking at.
 *
 * WHY THE WINDOW IS STATED RATHER THAN ASSUMED
 *
 * The analysis owns its own window and returns it (`window_start` /
 * `window_end`), which the panel shows. The breakdown here is computed
 * over the last 90 days to match, and says so. If the service's window
 * ever changes the two would disagree — which is why both are printed
 * rather than one being implied. The alternative, a single unlabelled
 * "reports" number, hides the disagreement instead of showing it.
 */

export const dynamic = "force-dynamic";

/** Mirrors the service's analysis window. Stated on screen rather than
 *  implied, so a divergence is visible rather than silent. */
const WINDOW_DAYS = 90;

/** How many reports to pull for the breakdown. The list endpoints have
 *  no date filter, so the window is applied here — which means a busy
 *  tenant can exceed this. `total` from the API tells us when that
 *  happened and the page says so rather than showing a short count as
 *  if it were the whole picture. */
const FETCH_LIMIT = 200;

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="text-2xl font-bold tabular-nums text-foreground">
        {value}
      </div>
      <div className="mt-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function BreakdownPanel({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: Array<[string, number]>;
  emptyLabel: string;
}) {
  return (
    <section
      aria-label={title}
      className="rounded-lg border border-border bg-card p-4"
    >
      <h2 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map(([label, count]) => (
            <li
              key={label}
              className="flex items-center justify-between gap-2 py-1.5 text-sm"
            >
              <span className="text-foreground">{label}</span>
              <span className="rounded bg-status-blue/15 px-2 py-0.5 text-[0.65rem] font-semibold tabular-nums text-status-blue">
                {count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function SafetyIntelligencePage() {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  let hazards: HazardReport[] = [];
  let incidents: Incident[] = [];
  let reported = 0;
  let loadError: string | null = null;
  // Tracked apart from loadError: a transient failure should still
  // leave the analysis offered, because it may well work. A 403 will
  // not — the analysis is gated to the same roles — and a button that
  // cannot succeed reads as "there is a way through this, I just have
  // not found it". Same reasoning as the weight-and-balance step.
  let forbidden = false;

  try {
    const [h, i] = await Promise.all([
      listHazards({ limit: FETCH_LIMIT }),
      listIncidents({ limit: FETCH_LIMIT }),
    ]);
    hazards = h.items;
    incidents = i.items;
    reported = h.total + i.total;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    forbidden = status === 403;
    loadError =
      status === 403
        ? "Safety Intelligence is limited to safety officers, chief pilots, the director of operations and admins."
        : "Could not load safety reports just now.";
  }

  const all: Report[] = [...hazards, ...incidents].filter((r) =>
    withinWindow(r.created_at, since),
  );
  // The list came back capped, so the breakdown below is over part of
  // the corpus. Say it rather than let a short count read as the total.
  const truncated = hazards.length + incidents.length >= FETCH_LIMIT * 2;

  const open = openCount(all);
  const byType = tally(all, (r) => humanise(r.category));
  const byLocation = tally(all, locationOf);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Safety Intelligence
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pattern analysis of the last {WINDOW_DAYS} days · {all.length} report
          {all.length === 1 ? "" : "s"} in window
        </p>
      </header>

      {loadError ? (
        <p
          role="alert"
          className="mb-6 rounded-md border border-status-red/30 bg-status-red/10 px-3 py-2 text-sm text-status-red"
        >
          {loadError}
        </p>
      ) : (
        <>
          {truncated && (
            <p
              role="status"
              className="mb-4 rounded-md border border-status-yellow/30 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
            >
              Showing the most recent {FETCH_LIMIT} hazards and {FETCH_LIMIT}{" "}
              incidents of {reported} filed. The breakdown below covers those,
              not the whole window.
            </p>
          )}

          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard value={all.length} label={`Reports (${WINDOW_DAYS}d)`} />
            <StatCard value={open} label="Open" />
            <StatCard value={byType.length} label="Categories" />
            <StatCard value={byLocation.length} label="Locations" />
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <BreakdownPanel
              title="Reports by type"
              rows={byType}
              emptyLabel={`No reports in the last ${WINDOW_DAYS} days.`}
            />
            <BreakdownPanel
              title="Top locations"
              rows={byLocation.slice(0, 10)}
              emptyLabel="No report carries a location."
            />
          </div>
        </>
      )}

      {!forbidden && <AnalysisPanel />}
    </div>
  );
}
