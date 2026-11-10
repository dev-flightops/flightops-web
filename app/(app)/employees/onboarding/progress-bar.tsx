import { cn } from "@/lib/utils";

/** How much of a hire's onboarding is done (#180): legacy's bar, red while
 *  a task is overdue, green when it's all done, blue otherwise. */
export function ProgressBar({ pct, overdue, className }: { pct: number; overdue: number; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${pct}% done`}
      className={cn("h-1.5 w-full overflow-hidden rounded-sm bg-muted", className)}
    >
      <div
        className={cn("h-full", overdue > 0 ? "bg-status-red" : pct === 100 ? "bg-status-green" : "bg-status-blue")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
