"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { downloadT100CsvAction } from "./actions";

/**
 * Which month, and the CSV.
 *
 * Months rather than days: a filing period is a calendar month, so
 * stepping by a day would offer periods that cannot be filed.
 *
 * The arithmetic is on year and month integers, not on a Date. Adding
 * a month to a Date is the classic trap — 31 January plus one month
 * lands on 3 March, and no filing period skips February.
 */
export function PeriodControls({
  year,
  month,
  hasRows,
}: {
  year: number;
  month: number;
  /** Nothing to export from an empty month, and a button that
   *  downloads a header row and a zero total is a button that wasted
   *  somebody's time. */
  hasRows: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goTo = (y: number, m: number) => {
    startTransition(() =>
      router.push(`/reports/regulatory/t100?year=${y}&month=${m}`),
    );
  };

  const shiftMonths = (delta: number) => {
    // Zero-based month arithmetic, then back to 1-12. Handles the
    // December/January rollover in both directions without a special
    // case to get wrong.
    const zero = year * 12 + (month - 1) + delta;
    goTo(Math.floor(zero / 12), (zero % 12) + 1);
  };

  async function download() {
    setDownloading(true);
    setError(null);
    const result = await downloadT100CsvAction(year, month);
    setDownloading(false);
    if (result.status !== "ok") {
      setError(result.message);
      return;
    }
    const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `t100_${year}-${String(month).padStart(2, "0")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const monthValue = `${year}-${String(month).padStart(2, "0")}`;

  return (
    <div className="flex flex-col items-end gap-1">
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
          aria-label="Filing period"
          value={monthValue}
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
        <button
          type="button"
          onClick={() => void download()}
          disabled={downloading || !hasRows}
          title={hasRows ? undefined : "Nothing to export for this month"}
          className="ml-1 rounded-md bg-status-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-40"
        >
          {downloading ? "Preparing…" : "Export CSV"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-[0.65rem] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}
