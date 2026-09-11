"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * Which month the books are being read for.
 *
 * Months, not days: a period anybody closes books against is a
 * calendar month, so stepping by a day would offer periods that cannot
 * be reconciled.
 *
 * Arithmetic on year and month integers, never by adding to a Date.
 * 31 January plus one month lands on 3 March, and no accounting period
 * skips February. Same helper shape as the T-100 filing controls.
 */
export function PeriodControls({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const goTo = (y: number, m: number) => {
    startTransition(() => router.push(`/accounting?year=${y}&month=${m}`));
  };

  const shiftMonths = (delta: number) => {
    // Zero-based, then back to 1-12. Handles the December/January
    // rollover in both directions without a special case to get wrong.
    const zero = year * 12 + (month - 1) + delta;
    goTo(Math.floor(zero / 12), (zero % 12) + 1);
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => shiftMonths(-1)}
        disabled={isPending}
        aria-label="Previous month"
        className="rounded-md border border-border bg-card px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40 disabled:opacity-60"
      >
        ←
      </button>
      <input
        type="month"
        aria-label="Accounting period"
        value={`${year}-${String(month).padStart(2, "0")}`}
        onChange={(e) => {
          const v = e.target.value;
          if (!/^\d{4}-\d{2}$/.test(v)) return;
          const [y, m] = v.split("-").map(Number);
          if (m < 1 || m > 12) return;
          goTo(y, m);
        }}
        disabled={isPending}
        className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-status-blue focus:outline-none disabled:opacity-60"
      />
      <button
        type="button"
        onClick={() => shiftMonths(1)}
        disabled={isPending}
        aria-label="Next month"
        className="rounded-md border border-border bg-card px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40 disabled:opacity-60"
      >
        →
      </button>
    </div>
  );
}
