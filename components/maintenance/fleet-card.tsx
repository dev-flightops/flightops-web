import Link from "next/link";

import { cn } from "@/lib/utils";
import type { FleetAircraftSummary } from "@/lib/api/types";

/**
 * One aircraft card on the Maintenance landing. Layout mirrors legacy
 * `templates/maintenance/dashboard.html` panel:
 *
 *   [N-number] [airframe chip] [base badge]  model               [Details →]
 *   🚩 [special-notes line — only when set, amber]
 *   ┌─────────────┬─────────────┬─────────────┐
 *   │ TTAF        │ Engine SMOH │ Prop        │
 *   │ 3,247.5 hrs │ 982.3 / 3600│ 982.3       │
 *   └─────────────┴─────────────┴─────────────┘
 *   [All items current / N Overdue / N Due Soon]
 *
 * Story progression on this card:
 *   M2-G-19  — first cut (status pill + count chips)
 *   M2-G-22b — legacy panel layout with 0.0 hr placeholders
 *   M2-G-23  — fields from M2-M-17 land: airframe chip, base badge,
 *              special-notes flag, real TTAF / SMOH / Prop numbers
 *              plus "/ TBO" denominator when set.
 *
 * Numbers render with US locale grouping (`3,247.5`) so a four-digit
 * TTAF doesn't read as a typo. TBO denominator is shown only when
 * the backend returns a non-null value — turboprops (PT6) run
 * on-condition and have no published TBO; the card hides the slash
 * for them entirely.
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
            {summary.airframe_type && (
              <AirframeChip airframeType={summary.airframe_type} />
            )}
            {summary.base && <BaseBadge base={summary.base} />}
            {!summary.is_active && <InactiveChip />}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {summary.aircraft.model || "No details"}
          </p>
          {summary.special_notes && (
            <p className="mt-1 flex items-center gap-1 text-xs text-status-yellow">
              <span aria-hidden>&#9873;</span>
              {summary.special_notes}
            </p>
          )}
        </div>
        <Link
          href={`/maintenance/aircraft/${summary.aircraft.id}`}
          className="shrink-0 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40"
        >
          Details →
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="TTAF" value={formatHours(summary.total_time_hours)} />
        <Stat
          label="Engine (SMOH)"
          value={formatHours(summary.engine_time_hours)}
          tbo={summary.engine_tbo_hours}
        />
        <Stat
          label="Prop"
          value={formatHours(summary.prop_time_hours)}
          tbo={summary.prop_tbo_hours}
        />
      </div>

      <FooterBadge
        blockingCount={summary.blocking_count}
        advisoryCount={summary.advisory_count}
      />
    </article>
  );
}

/** Format hours with US locale grouping + always one decimal so
 *  "0" reads as "0.0" — matches legacy fleet card. */
function formatHours(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/** Six known airframe slugs map to a colored chip; anything else
 *  falls back to muted gray. Slug list mirrors the legacy
 *  `AIRFRAME_COLOR` dict in `modules/crew/models.py`. */
const AIRFRAME_PALETTE: Record<
  string,
  { abbr: string; className: string }
> = {
  c207: {
    abbr: "C207",
    className: "bg-status-green/15 text-status-green border border-status-green/30",
  },
  caravan: {
    abbr: "CARA",
    className: "bg-status-orange/15 text-status-orange border border-status-orange/30",
  },
  pa31: {
    abbr: "PA31",
    className: "bg-status-blue/15 text-status-blue border border-status-blue/30",
  },
  kingair: {
    abbr: "K200",
    className: "bg-status-purple/15 text-status-purple border border-status-purple/30",
  },
  ga8: {
    abbr: "GA8",
    className: "bg-status-yellow/15 text-status-yellow border border-status-yellow/30",
  },
  navajo: {
    abbr: "NAV",
    className: "bg-status-red/15 text-status-red border border-status-red/30",
  },
};

function AirframeChip({ airframeType }: { airframeType: string }) {
  const entry = AIRFRAME_PALETTE[airframeType.toLowerCase()] ?? {
    abbr: airframeType.toUpperCase().slice(0, 4),
    className: "bg-muted/40 text-muted-foreground border border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.05em]",
        entry.className,
      )}
    >
      {entry.abbr}
    </span>
  );
}

function BaseBadge({ base }: { base: string }) {
  return (
    <span className="rounded bg-muted/40 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
      {base}
    </span>
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
  tbo,
}: {
  label: string;
  value: string;
  /** When set, render the TBO denominator next to the value
   *  (`982.3 / 3,600 hrs`). Turboprops with no published TBO
   *  omit it. */
  tbo?: number | null;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="text-[0.65rem] text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg font-bold tabular-nums text-foreground">
        {value}
        {tbo != null && (
          <span className="ml-1 text-[0.7rem] font-normal text-muted-foreground">
            / {tbo.toLocaleString("en-US")}
          </span>
        )}
        <span className="ml-1 text-[0.65rem] font-normal text-muted-foreground">
          hrs
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
