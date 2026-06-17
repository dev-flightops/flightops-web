import Link from "next/link";

import type { FleetAircraftSummary } from "@/lib/api/types";

/**
 * Fleet Airworthiness panel — vertical list of every active aircraft
 * with its airworthiness badge. Mirrors the legacy peregrineflight
 * Executive dashboard's same-named panel:
 *
 *   ┌─────────────────────────────────────┐
 *   │ FLEET AIRWORTHINESS                 │
 *   │ N1026V   N1026V   —   🟢 Airworthy  │
 *   │ N1029Y   N1029Y   —   🟢 Airworthy  │
 *   │ ... (one row per active aircraft)   │
 *   │ 0 open squawks · 0 pending RTS · …  │
 *   │                       Maintenance → │
 *   └─────────────────────────────────────┘
 *
 * Data is the already-fetched snapshot.fleet — same rollup that drives
 * the Fleet Airworthy stat tile, so no extra request.
 */

interface Props {
  fleet: FleetAircraftSummary[];
}

export function FleetAirworthinessPanel({ fleet }: Props) {
  const active = fleet.filter((r) => r.is_active);
  const openSquawks = active.reduce((s, r) => s + r.open_squawk_count, 0);
  const openMels = active.reduce((s, r) => s + r.open_mel_count, 0);
  const pendingRts = active.filter((r) => !r.is_airworthy).length;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Fleet Airworthiness
      </h2>

      <div className="max-h-[560px] space-y-1.5 overflow-y-auto pr-2">
        {active.length === 0 ? (
          <p className="text-xs text-muted-foreground">No aircraft on file.</p>
        ) : (
          active
            .slice()
            .sort((a, b) =>
              a.aircraft.tail_number.localeCompare(b.aircraft.tail_number),
            )
            .map((row) => <Row key={row.aircraft.id} row={row} />)
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3 text-[0.65rem] text-muted-foreground/70">
        <span>
          <span className="text-foreground">{openSquawks}</span> open squawks ·{" "}
          <span className="text-foreground">{pendingRts}</span> pending RTS ·{" "}
          <span className="text-foreground">{openMels}</span> MEL deferred
        </span>
        <Link
          href="/maintenance"
          className="text-status-blue hover:underline"
        >
          Maintenance →
        </Link>
      </div>
    </section>
  );
}

function Row({ row }: { row: FleetAircraftSummary }) {
  const tail = row.aircraft.tail_number;
  // Treat literal "Unknown" the same as null — the maintenance service
  // stamps that placeholder on aircraft imported without a model field.
  const rawModel = row.aircraft.model;
  const model =
    rawModel && rawModel.toLowerCase() !== "unknown" ? rawModel : null;
  const grounded = !row.is_airworthy;
  const advisory = row.is_airworthy && row.advisory_count > 0;

  let badge = (
    <span className="text-status-green">🟢 Airworthy</span>
  );
  if (advisory) {
    badge = <span className="text-status-yellow">🟡 Advisory</span>;
  }
  if (grounded) {
    badge = <span className="text-status-red">🔴 Grounded</span>;
  }

  return (
    <Link
      href={`/maintenance/aircraft/${row.aircraft.id}`}
      className="flex items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-primary/5"
    >
      <span className="w-16 flex-shrink-0 font-mono font-semibold text-foreground">
        {tail}
      </span>
      <span className="flex-1 truncate text-xs text-muted-foreground">
        {model ?? <span className="text-muted-foreground/40">—</span>}
      </span>
      <span className="text-xs text-muted-foreground/40">
        {row.base ?? "—"}
      </span>
      <span className="text-xs">{badge}</span>
    </Link>
  );
}
