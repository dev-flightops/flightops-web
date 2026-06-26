import type { FlightLogLeg } from "@/lib/api/types";

import { computeFlightLogSummary } from "./summary-fields";

/**
 * Tab 4 — Flight Summary (Spec 4 §"7-tab Electronic Flight Log /
 * Tab 4: Flight Summary").
 *
 * Read-only roll-up of per-leg totals. Mirrors the top section of
 * legacy `templates/elog/log_page.html` Tab 4: three big tiles
 * (Flight / Block / Hobbs) plus a secondary row of counters
 * (Landings / Night Ldgs / Fuel).
 *
 * Pilot-writable currency-impacting fields the legacy form also
 * hosted (approach counts, holds, IFR hours, night T/O) are NOT in
 * this PR — they feed Spec 5 currency math and land alongside the
 * M2-M-9 auto-fire chain so the data-shape decision and the
 * compute-on-submit wiring ship together.
 *
 * Null totals (a leg has missing times or hobbs) render "—" rather
 * than 0.0 so a half-filled draft doesn't look submission-ready.
 */
export function SummaryTab({ legs }: { legs: ReadonlyArray<FlightLogLeg> }) {
  const summary = computeFlightLogSummary(legs);

  if (summary.legCount === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Flight Summary
        </h2>
        <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-6 text-center text-xs text-muted-foreground">
          No legs entered yet. Add legs in{" "}
          <span className="font-semibold text-foreground">Tab 2 (Legs)</span>{" "}
          to see totals here.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Flight Summary — Totals
      </h2>

      <div className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-card/60 p-4 text-center">
        <BigTile
          label="Total Flight Time"
          value={summary.totalFlightHours}
          tone="green"
        />
        <BigTile
          label="Total Block Time"
          value={summary.totalBlockHours}
          tone="blue"
        />
        <BigTile
          label="Total Hobbs"
          value={summary.totalHobbsHours}
          tone="yellow"
        />
      </div>

      <div className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-card p-4 text-center sm:grid-cols-6">
        <Counter label="Legs" value={summary.legCount} />
        <Counter label="Landings" value={summary.totalLandings} />
        <Counter
          label="Night Ldgs"
          value={summary.totalNightLandings}
          dim={summary.totalNightLandings === 0}
        />
        <Counter
          label="Fuel (gal)"
          value={formatGallons(summary.totalFuelGallons)}
          dim={summary.totalFuelGallons === null}
        />
      </div>

      <p className="text-[0.65rem] text-muted-foreground">
        Totals are derived from Tab 2 (Legs). Edit a leg to update
        these numbers.
      </p>
    </div>
  );
}

function BigTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null;
  tone: "green" | "blue" | "yellow";
}) {
  const toneCls =
    tone === "green"
      ? "text-status-green"
      : tone === "blue"
        ? "text-status-blue"
        : "text-status-yellow";
  return (
    <div>
      <div className="text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-2xl font-extrabold tabular-nums ${
          value === null ? "text-muted-foreground/70" : toneCls
        }`}
      >
        {value === null ? "—" : value.toFixed(1)}
      </div>
    </div>
  );
}

function Counter({
  label,
  value,
  dim = false,
}: {
  label: string;
  value: number | string;
  dim?: boolean;
}) {
  return (
    <div>
      <div className="text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-base font-bold tabular-nums ${
          dim ? "text-muted-foreground/60" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function formatGallons(g: number | null): string {
  if (g === null) return "—";
  return g.toFixed(1);
}
