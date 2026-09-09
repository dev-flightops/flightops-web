"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * Which day's flights to assess.
 *
 * UTC on both ends — `T00:00:00Z` to parse and `setUTCDate` to step.
 * Stepping in local time is what made the fleet board's arrows skip
 * two days at a time west of Greenwich in August, and the same trap
 * sits in every date control we write.
 */
export function DayPicker({ date }: { date: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const goTo = (next: string) => {
    if (!next) return;
    startTransition(() => router.push(`/ai/delay-alerts?date=${next}`));
  };

  const shift = (days: number) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    goTo(d.toISOString().slice(0, 10));
  };

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => shift(-1)}
        disabled={isPending}
        aria-label="Previous day"
        className="rounded-md border border-border bg-card px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40 disabled:opacity-60"
      >
        ←
      </button>
      <input
        type="date"
        aria-label="Flights date (UTC)"
        value={date}
        onChange={(e) => goTo(e.target.value)}
        disabled={isPending}
        className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-status-blue focus:outline-none disabled:opacity-60"
      />
      <button
        type="button"
        onClick={() => shift(1)}
        disabled={isPending}
        aria-label="Next day"
        className="rounded-md border border-border bg-card px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40 disabled:opacity-60"
      >
        →
      </button>
    </div>
  );
}
