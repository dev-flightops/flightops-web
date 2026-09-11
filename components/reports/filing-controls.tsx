"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** What a filing CSV action returns. Mirrors the server actions. */
export type CsvResult =
  | { status: "ok"; csv: string }
  | { status: "error"; message: string };

/**
 * Period picker and CSV export, shared by the five regulatory returns.
 *
 * Started as T-100's own component. Generalised when the other four
 * landed rather than copied four times: the month arithmetic below is
 * the part that goes wrong, and five copies of it is five chances to
 * get the December rollover wrong in one of them.
 *
 * The download action arrives as a prop because it has to. Each return
 * fetches its own CSV through `apiFetch`, which begins with `await
 * auth()` and is server-only — a client component importing it throws
 * on every call, and `lib/api/client-boundary.test.ts` fails the build
 * for it. Server actions are passable as props, so the boundary stays
 * on the server side where it belongs.
 */

/** Turn CSV text into a file the browser saves. */
function save(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Left unrevoked, each export holds the file until the tab closes.
  URL.revokeObjectURL(url);
}

function ExportButton({
  disabled,
  onClick,
  busy,
}: {
  disabled: boolean;
  onClick: () => void;
  busy: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      title={disabled ? "Nothing to export for this period" : undefined}
      className="ml-1 rounded-md bg-status-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-40"
    >
      {busy ? "Preparing…" : "Export CSV"}
    </button>
  );
}

function StepButton({
  label,
  glyph,
  onClick,
  disabled,
}: {
  label: string;
  glyph: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded-md border border-border bg-card px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40 disabled:opacity-60"
    >
      {glyph}
    </button>
  );
}

/**
 * Monthly filing period — T-100, PS 5500, CAM, USPS 5394.
 *
 * Months rather than days: a filing period is a calendar month, so
 * stepping by a day would offer periods that cannot be filed.
 *
 * The arithmetic is on year and month integers, never on a Date.
 * Adding a month to a Date is the classic trap — 31 January plus one
 * month lands on 3 March, and no filing period skips February.
 */
export function MonthlyFilingControls({
  basePath,
  filePrefix,
  year,
  month,
  hasRows,
  downloadAction,
}: {
  /** Route to push when the period changes. */
  basePath: string;
  /** Leading part of the saved filename, before the period. */
  filePrefix: string;
  year: number;
  month: number;
  /** Nothing to export from an empty period, and a button that
   *  downloads a header row and a zero total wastes somebody's time
   *  and looks like a broken export. */
  hasRows: boolean;
  downloadAction: (year: number, month: number) => Promise<CsvResult>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goTo = (y: number, m: number) => {
    startTransition(() => router.push(`${basePath}?year=${y}&month=${m}`));
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
    const result = await downloadAction(year, month);
    setDownloading(false);
    if (result.status !== "ok") {
      setError(result.message);
      return;
    }
    save(
      result.csv,
      `${filePrefix}_${year}-${String(month).padStart(2, "0")}.csv`,
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <StepButton
          label="Previous month"
          glyph="←"
          onClick={() => shiftMonths(-1)}
          disabled={isPending}
        />
        <input
          type="month"
          aria-label="Filing period"
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
        <StepButton
          label="Next month"
          glyph="→"
          onClick={() => shiftMonths(1)}
          disabled={isPending}
        />
        <ExportButton
          disabled={!hasRows}
          busy={downloading}
          onClick={() => void download()}
        />
      </div>
      {error && (
        <p role="alert" className="text-[0.65rem] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Quarterly filing period — DOT Form 41 only.
 *
 * No `<input type="month">` equivalent exists for quarters, so the
 * period is a select of the four rather than a typed field. Stepping
 * is the same integer arithmetic, base four instead of twelve: Q4 to
 * Q1 crosses a year exactly as December to January does.
 */
export function QuarterlyFilingControls({
  basePath,
  filePrefix,
  year,
  quarter,
  hasRows,
  downloadAction,
}: {
  basePath: string;
  filePrefix: string;
  year: number;
  quarter: number;
  hasRows: boolean;
  downloadAction: (year: number, quarter: number) => Promise<CsvResult>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goTo = (y: number, q: number) => {
    startTransition(() => router.push(`${basePath}?year=${y}&quarter=${q}`));
  };

  const shiftQuarters = (delta: number) => {
    const zero = year * 4 + (quarter - 1) + delta;
    goTo(Math.floor(zero / 4), (zero % 4) + 1);
  };

  async function download() {
    setDownloading(true);
    setError(null);
    const result = await downloadAction(year, quarter);
    setDownloading(false);
    if (result.status !== "ok") {
      setError(result.message);
      return;
    }
    // Qn, not a zero-padded month: "2026-03" for Q3 reads as March.
    save(result.csv, `${filePrefix}_${year}-Q${quarter}.csv`);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <StepButton
          label="Previous quarter"
          glyph="←"
          onClick={() => shiftQuarters(-1)}
          disabled={isPending}
        />
        <select
          aria-label="Filing period"
          value={`${year}-Q${quarter}`}
          onChange={(e) => {
            const m = /^(\d{4})-Q([1-4])$/.exec(e.target.value);
            if (!m) return;
            goTo(Number(m[1]), Number(m[2]));
          }}
          disabled={isPending}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-status-blue focus:outline-none disabled:opacity-60"
        >
          {/* The viewed quarter and the eight around it. Enough to
              reach last year's filings without a year picker. */}
          {Array.from({ length: 9 }, (_, i) => {
            const zero = year * 4 + (quarter - 1) - 4 + i;
            const y = Math.floor(zero / 4);
            const q = (zero % 4) + 1;
            return (
              <option key={`${y}-Q${q}`} value={`${y}-Q${q}`}>
                Q{q} {y}
              </option>
            );
          })}
        </select>
        <StepButton
          label="Next quarter"
          glyph="→"
          onClick={() => shiftQuarters(1)}
          disabled={isPending}
        />
        <ExportButton
          disabled={!hasRows}
          busy={downloading}
          onClick={() => void download()}
        />
      </div>
      {error && (
        <p role="alert" className="text-[0.65rem] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}
