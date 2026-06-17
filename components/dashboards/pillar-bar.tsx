import { cn } from "@/lib/utils";

/**
 * Horizontal progress bar used in the Ops Score pillar breakdown
 * (Completion / On-Time / Crew / Fleet / Safety) on the Executive and
 * Ops Score dashboards. Fill color tracks the percentage of max:
 *
 *   ≥75% of max  green   (on target)
 *   ≥50% of max  yellow  (watch)
 *   <50% of max  red     (issue)
 *
 * The score is displayed as a big number with a small ` / max` suffix
 * to match legacy peregrineflight's emphasis (the dial number is the
 * thing that matters; the denominator is reference). `context` adds a
 * short reason-line under the bar — "54/54 airworthy", "No flights
 * scheduled today", etc. — so the user sees *why* the pillar scored
 * as it did, not just the number.
 */
export function PillarBar({
  label,
  score,
  max,
  icon,
  context,
}: {
  label: string;
  score: number;
  max: number;
  icon?: React.ReactNode;
  context?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((score / max) * 100)) : 0;
  const tone =
    pct >= 75
      ? "bg-status-green"
      : pct >= 50
        ? "bg-status-yellow"
        : "bg-status-red";

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <div className="flex items-center gap-2 text-foreground/90">
          {icon}
          <span className="font-medium">{label}</span>
        </div>
        <div className="font-mono tabular-nums">
          <span className="text-base font-semibold text-foreground">
            {score.toFixed(1)}
          </span>
          <span className="ml-1 text-[0.7rem] text-muted-foreground">
            / {max}
          </span>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full transition-all", tone)}
          style={{ width: `${pct}%` }}
          aria-valuenow={score}
          aria-valuemax={max}
          aria-valuemin={0}
          role="progressbar"
          aria-label={`${label} score`}
        />
      </div>
      {context && (
        <p className="text-[0.7rem] text-muted-foreground/80">{context}</p>
      )}
    </div>
  );
}
