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
        "rounded-lg border border-border p-5",
        // Out of service reads from the ground and the grounding chip,
        // not from fading the card: the grounded aircraft is the one
        // whose reason most needs to be legible.
        summary.is_active ? "bg-card" : "bg-muted/60",
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
            {!summary.is_active && (
              <GroundingChip
                reason={summary.grounded_reason}
                groundedAt={summary.grounded_at}
              />
            )}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {formatIdentityLine({
              year: summary.year,
              make: summary.make,
              model: summary.aircraft.model,
            })}
            {summary.serial_number && (
              <span className="text-muted-foreground">
                {" · S/N "}
                <span className="font-mono">{summary.serial_number}</span>
              </span>
            )}
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
          className="btn-caps shrink-0 rounded-md border border-input px-3 py-1.5 text-foreground hover:bg-accent text-[0.72rem]"
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

/** The maintenance service stamps the literal string "Unknown" on
 *  aircraft imported without a model field. Legacy renders "No
 *  details" for both empty AND that placeholder, so we treat them
 *  the same. Mirrors the same null-vs-"Unknown" logic in
 *  components/dashboards/fleet-airworthiness-panel.tsx. */
function displayModel(rawModel: string | null): string {
  if (!rawModel) return "No details";
  if (rawModel.toLowerCase() === "unknown") return "No details";
  return rawModel;
}

/**
 * The airframe identity line: "2019 Cessna 208 Caravan".
 *
 * Mirrors legacy `templates/maintenance/dashboard.html`, which joins
 * whichever of year / make / model are set and falls back to "No
 * details" when none are:
 *
 *   {{ [ac.year, ac.make, ac.model] | select | join(" ") or "No details" }}
 *
 * Exported for tests — every combination of the three being absent is a
 * real state (spreadsheet imports routinely carry only a tail number),
 * and getting the fallback wrong renders a bare or ragged line.
 *
 * S/N is deliberately NOT part of this string: legacy separates it with
 * a middot and the card renders it in its own styled span.
 */
export function formatIdentityLine({
  year,
  make,
  model,
}: {
  year: number | null;
  make: string | null;
  model: string | null;
}): string {
  const modelText = displayModel(model);
  const parts = [
    year != null ? String(year) : null,
    make?.trim() || null,
    // displayModel() returns the "No details" placeholder, which is a
    // fallback for the whole line rather than a part of it.
    modelText === "No details" ? null : modelText,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" ") : "No details";
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
    className: "text-status-green",
  },
  caravan: {
    abbr: "CARA",
    className: "text-status-orange",
  },
  pa31: {
    abbr: "PA31",
    className: "text-status-blue",
  },
  kingair: {
    abbr: "K200",
    className: "text-status-purple",
  },
  // The Beech 1900D is its own type, not a King Air (#155: the client's
  // 1900D was tagged K200).
  "1900d": {
    abbr: "B190",
    className: "text-status-purple",
  },
  ga8: {
    abbr: "GA8",
    className: "text-status-yellow",
  },
  navajo: {
    abbr: "NAV",
    className: "text-status-red",
  },
};

function AirframeChip({ airframeType }: { airframeType: string }) {
  const entry = AIRFRAME_PALETTE[airframeType.toLowerCase()] ?? {
    abbr: airframeType.toUpperCase().slice(0, 4),
    className: "bg-muted text-muted-foreground border border-border",
  };
  return (
    <span
      className={cn(
        "status-mark text-[0.6rem]",
        entry.className,
      )}
    >
      {entry.abbr}
    </span>
  );
}

function BaseBadge({ base }: { base: string }) {
  return (
    <span className="eyebrow">
      {base}
    </span>
  );
}

/**
 * M2-M-15 — the fleet card distinguishes the grounding source so CP
 * and MX can triage at a glance:
 *   mel_expired — auto-grounded by the watcher (yellow, "MEL EXPIRED")
 *   fuel_hold   — Spec 6 fuel-quality cascade (yellow, "FUEL HOLD")
 *   manual      — admin-initiated ground (muted, "GROUNDED")
 *   null / other — legacy row from before the reason column was
 *                  populated (muted, "INACTIVE")
 */
function GroundingChip({
  reason,
  groundedAt,
}: {
  reason: string | null;
  groundedAt: string | null;
}) {
  const config = groundingChipConfig(reason);
  const tooltip = groundedAt
    ? `${config.label} at ${groundedAt.slice(0, 16).replace("T", " ")} UTC`
    : config.label;
  return (
    <span title={tooltip} className={config.className}>
      {config.label}
    </span>
  );
}

function groundingChipConfig(reason: string | null): {
  label: string;
  className: string;
} {
  const base =
    "status-mark text-[0.6rem]";
  switch (reason) {
    case "mel_expired":
      return {
        label: "MEL Expired",
        className: `${base} text-status-yellow`,
      };
    case "fuel_hold":
      return {
        label: "Fuel Hold",
        className: `${base} text-status-yellow`,
      };
    case "manual":
      return {
        label: "Grounded",
        className: `${base} text-status-red`,
      };
    default:
      return {
        label: "Inactive",
        className: `${base} text-muted-foreground`,
      };
  }
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
          <span className="text-[0.7rem] font-normal text-muted-foreground">
            {` / ${tbo.toLocaleString("en-US")}`}
          </span>
        )}
        <span className="text-[0.65rem] font-normal text-muted-foreground">
          {" hrs"}
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
    red: "text-status-red",
    yellow: "text-status-yellow",
    green: "text-status-green",
  }[tone];
  return (
    <span
      className={cn(
        "status-mark text-[0.65rem]",
        toneClass,
      )}
    >
      {children}
    </span>
  );
}
