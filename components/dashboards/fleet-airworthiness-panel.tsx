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
  /** Section heading text. Legacy uses "Fleet Airworthiness" on the
   *  executive dashboard and "Fleet Availability" on the dispatcher
   *  dashboard for the same component shape — override per host. */
  title?: string;
}

export function FleetAirworthinessPanel({
  fleet,
  title = "Fleet Airworthiness",
}: Props) {
  const active = fleet.filter((r) => r.is_active);
  const openSquawks = active.reduce((s, r) => s + r.open_squawk_count, 0);
  const openMels = active.reduce((s, r) => s + r.open_mel_count, 0);
  const pendingRts = active.filter((r) => !r.is_airworthy).length;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {title}
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

      <div className="mt-3 border-t border-border pt-3 text-[0.65rem] text-muted-foreground/70">
        {/* "Maintenance →" link dropped for the M1 demo deploy — the
            /maintenance route is gated in the home grid + ops sub-nav,
            so this drill-in shouldn't escape that. The rollup numbers
            still render. Restore the Link when the deploy promotes
            past M1 (search "M1 demo deploy"). */}
        <span>
          <span className="text-foreground">{openSquawks}</span> open squawks ·{" "}
          <span className="text-foreground">{pendingRts}</span> pending RTS ·{" "}
          <span className="text-foreground">{openMels}</span> MEL deferred
        </span>
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

  // Colored-dot pattern (same shape as the score-band legend on
  // /dashboards/ops-score) instead of 🟢🟡🔴 emoji — those fall back
  // to missing-glyph boxes on systems without an emoji font installed.
  let badge = <StatusBadge tone="green" label="Airworthy" />;
  if (advisory) {
    badge = <StatusBadge tone="yellow" label="Advisory" />;
  }
  if (grounded) {
    badge = <StatusBadge tone="red" label="Grounded" />;
  }

  // Row is rendered as a plain <div> for the M1 demo deploy — the
  // per-aircraft detail route (/maintenance/aircraft/{id}) is gated,
  // and the dashboards (where this panel lives) shouldn't be a back
  // door. Restore the wrapping <Link href={`/maintenance/aircraft/...`}>
  // when the deploy promotes past M1 (search "M1 demo deploy").
  return (
    <div className="flex items-center gap-2 rounded px-1 py-0.5 text-xs">
      <span className="w-16 flex-shrink-0 font-mono font-semibold text-foreground">
        {tail}
      </span>
      <span className="flex-1 truncate text-xs text-muted-foreground">
        {model ?? <span className="text-muted-foreground/40">—</span>}
      </span>
      <span className="text-xs text-muted-foreground/40">
        {row.base ?? "—"}
      </span>
      {badge}
    </div>
  );
}

function StatusBadge({
  tone,
  label,
}: {
  tone: "green" | "yellow" | "red";
  label: string;
}) {
  const dotClass =
    tone === "green"
      ? "bg-status-green"
      : tone === "yellow"
        ? "bg-status-yellow"
        : "bg-status-red";
  const textClass =
    tone === "green"
      ? "text-status-green"
      : tone === "yellow"
        ? "text-status-yellow"
        : "text-status-red";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${textClass}`}>
      <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden />
      {label}
    </span>
  );
}
