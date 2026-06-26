import type { FlightLogLeg, FlightLogResponse } from "@/lib/api/types";

import { CurrencyCountersField } from "./currency-counters-field";
import { computeFlightLogSummary } from "./summary-fields";

/**
 * Tab 4 — Flight Summary (Spec 4 §"7-tab Electronic Flight Log /
 * Tab 4: Flight Summary").
 *
 * Three sections:
 *   1. Read-only tiles (Flight / Block / Hobbs) summed from legs
 *   2. Read-only counter row (Legs / Landings / Night Ldgs / Fuel)
 *      derived from legs
 *   3. Pilot-writable currency counters (Night T/O, approaches,
 *      holds, IFR minutes) — log-level fields the M2-M-9b recompute
 *      reads on submission to bump rolling-window currency records.
 *
 * Null totals render "—" so a half-filled draft doesn't look
 * submission-ready.
 */
export function SummaryTab({
  log,
  legs,
}: {
  log: FlightLogResponse;
  legs: ReadonlyArray<FlightLogLeg>;
}) {
  const summary = computeFlightLogSummary(legs);
  const readOnly = log.status === "submitted";

  return (
    <div className="space-y-4">
      <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Flight Summary — Totals
      </h2>

      {summary.legCount === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-6 text-center text-xs text-muted-foreground">
          No legs entered yet. Add legs in{" "}
          <span className="font-semibold text-foreground">Tab 2 (Legs)</span>{" "}
          to see derived totals.
        </div>
      ) : (
        <>
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
            Tiles are derived from Tab 2 (Legs). Edit a leg to update them.
          </p>
        </>
      )}

      <CurrencyCountersField
        logId={log.id}
        readOnly={readOnly}
        initial={{
          night_takeoffs: log.night_takeoffs ?? null,
          approach_precision: log.approach_precision ?? null,
          approach_non_precision: log.approach_non_precision ?? null,
          holds: log.holds ?? null,
          ifr_actual_minutes: log.ifr_actual_minutes ?? null,
          ifr_simulated_minutes: log.ifr_simulated_minutes ?? null,
        }}
      />
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
