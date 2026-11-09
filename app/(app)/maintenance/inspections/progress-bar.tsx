import { cn } from "@/lib/utils";

/** How much of an inspection's checklist is passed or corrected (#178):
 *  blue, then yellow past half, green when it's all done, as legacy's bar. */
export function ProgressBar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${pct}% checked`}
      className={cn("h-1.5 w-full overflow-hidden rounded-sm bg-muted", className)}
    >
      <div
        className={cn("h-full", pct === 100 ? "bg-status-green" : pct > 50 ? "bg-status-yellow" : "bg-status-blue")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
