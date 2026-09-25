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
 * skips February.
 *
 * Moved out of the accounting page when Profitability needed the same
 * control. `basePath` is the only difference between the two, and a
 * second copy would have been a second chance to get the December
 * rollover wrong.
 *
 * Not the same component as `MonthlyFilingControls`: that one carries
 * a CSV export, because a filing is a file that leaves the building.
 * These two pages are read on screen.
 */
export function PeriodControls({
  basePath,
  label,
  year,
  month,
}: {
  /** Route to push when the period changes. */
  basePath: string;
  /** What the field is called, for the screen reader. "Accounting
   *  period" and "Reporting period" are different enough to be worth
   *  saying. */
  label: string;
  year: number;
  month: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const goTo = (y: number, m: number) => {
    startTransition(() => router.push(`${basePath}?year=${y}&month=${m}`));
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
        className="rounded-md border border-border bg-card px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-60"
      >
        ←
      </button>
      <input
        type="month"
        aria-label={label}
        value={`${year}-${String(month).padStart(2, "0")}`}
        onChange={(e) => {
          const v = e.target.value;
          if (!/^\d{4}-\d{2}$/.test(v)) return;
          const [y, m] = v.split("-").map(Number);
          if (m < 1 || m > 12) return;
          goTo(y, m);
        }}
        disabled={isPending}
        className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none disabled:opacity-60"
      />
      <button
        type="button"
        onClick={() => shiftMonths(1)}
        disabled={isPending}
        aria-label="Next month"
        className="rounded-md border border-border bg-card px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-60"
      >
        →
      </button>
    </div>
  );
}
