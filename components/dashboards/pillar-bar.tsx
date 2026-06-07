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
 * Callers pass `score` and `max` separately because the legacy displays
 * both ("25.0 / 25") and color-codes against the ratio.
 */
export function PillarBar({
  label,
  score,
  max,
  icon,
}: {
  label: string;
  score: number;
  max: number;
  icon?: React.ReactNode;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((score / max) * 100)) : 0;
  const tone =
    pct >= 75
      ? "bg-status-green"
      : pct >= 50
        ? "bg-status-yellow"
        : "bg-status-red";

  return (
    <div className="grid grid-cols-[1fr,2fr,auto] items-center gap-3 text-xs">
      <div className="flex items-center gap-2 text-foreground/80">
        {icon}
        <span>{label}</span>
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
      <span className="font-mono text-[0.7rem] tabular-nums text-muted-foreground">
        {score.toFixed(1)}/{max}
      </span>
    </div>
  );
}
