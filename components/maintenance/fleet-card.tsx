import Link from "next/link";

import { cn } from "@/lib/utils";
import type { FleetAircraftSummary } from "@/lib/api/types";

/**
 * One aircraft card on the Maintenance landing (M2-G-22b).
 *
 * Layout mirrors legacy `templates/maintenance/dashboard.html` panel:
 *
 *   [N-number]   model · S/N                          [Details →]
 *   [Special-notes flag line — optional]
 *   ┌─────────────┬─────────────┬─────────────┐
 *   │ TTAF        │ Engine SMOH │ Prop        │
 *   │ 0.0 hrs     │ 0.0 hrs     │ 0.0 hrs     │
 *   └─────────────┴─────────────┴─────────────┘
 *   [Footer status badge: ALL ITEMS CURRENT / X Overdue / X Due Soon]
 *
 * Status badge is derived from the M2-M-16 verdict counts:
 *   blocking_count > 0                    → "{N} Overdue"   (red)
 *   blocking_count = 0 && advisory_count  → "{N} Due Soon"  (yellow)
 *   both = 0                              → "ALL ITEMS CURRENT" (green)
 *
 * TTAF / Engine SMOH / Prop columns render `0.0 hrs` placeholders —
 * Aircraft model doesn't have those columns yet. The legacy demo
 * also displays 0.0 hrs, so this is faithful to what dispatchers
 * see on peregrineflight.com today; M2-M-17 will populate the real
 * numbers once the migration ships.
 */
export function FleetCard({ summary }: { summary: FleetAircraftSummary }) {
  return (
    <article
      className={cn(
        "rounded-xl border border-border bg-card p-5",
        !summary.is_active && "opacity-60",
      )}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
              {summary.aircraft.tail_number}
            </h2>
            {!summary.is_active && <InactiveChip />}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {summary.aircraft.model || "No details"}
          </p>
        </div>
        <Link
          href={`/maintenance/aircraft/${summary.aircraft.id}`}
          className="shrink-0 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40"
        >
          Details →
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="TTAF" value="0.0" unit="hrs" />
        <Stat label="Engine (SMOH)" value="0.0" unit="hrs" />
        <Stat label="Prop" value="0.0" unit="hrs" />
      </div>

      <FooterBadge
        blockingCount={summary.blocking_count}
        advisoryCount={summary.advisory_count}
      />
    </article>
  );
}

function InactiveChip() {
  return (
    <span className="rounded bg-muted/40 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      Inactive
    </span>
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="text-[0.65rem] text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg font-bold tabular-nums text-foreground">
        {value}
        <span className="ml-1 text-[0.65rem] font-normal text-muted-foreground">
          {unit}
        </span>
      </div>
    </div>
  );
}

function FooterBadge({
  blockingCount,
  advisoryCount,
}: {
  blockingCount: number;
  advisoryCount: number;
}) {
  if (blockingCount > 0) {
    return <Badge tone="red">{blockingCount} Overdue</Badge>;
  }
  if (advisoryCount > 0) {
    return <Badge tone="yellow">{advisoryCount} Due Soon</Badge>;
  }
  return <Badge tone="green">All items current</Badge>;
}

function Badge({
  tone,
  children,
}: {
  tone: "red" | "yellow" | "green";
  children: React.ReactNode;
}) {
  const toneClass = {
    red: "bg-status-red/15 text-status-red",
    yellow: "bg-status-yellow/15 text-status-yellow",
    green: "bg-status-green/15 text-status-green",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em]",
        toneClass,
      )}
    >
      {children}
    </span>
  );
}
