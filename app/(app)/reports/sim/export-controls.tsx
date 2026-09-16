"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { SimBasis, SimFormat } from "@/lib/api/reports";

/** What the download action returns. */
export type FileResult =
  | { status: "ok"; body: string; filename: string }
  | { status: "error"; message: string };

/**
 * The window, the basis, the format, and the download.
 *
 * A date range rather than `PeriodControls`' month stepper, because a
 * schedule export is not a closed accounting period — it is a
 * publishing window, and legacy's own quick exports are all "the
 * coming week".
 *
 * The download action arrives as a prop for the same reason it does on
 * the five filings: it goes through `apiFetch`, which begins with
 * `await auth()` and is server-only, and `lib/api/client-boundary.test
 * .ts` fails the build if a client component imports it.
 */

const MIME: Record<SimFormat, string> = {
  csv: "text/csv;charset=utf-8",
  fixed: "text/plain;charset=utf-8",
  xml: "application/xml;charset=utf-8",
};

const FORMAT_LABEL: Record<SimFormat, string> = {
  csv: "CSV",
  fixed: "Fixed-width SIM",
  xml: "XML",
};

function save(body: string, filename: string, format: SimFormat) {
  const url = URL.createObjectURL(new Blob([body], { type: MIME[format] }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ExportControls({
  carrier,
  start,
  end,
  basis,
  records,
  downloadAction,
}: {
  /** The operator's designator, for the saved filename.
   *
   *  Passed down rather than closed over on the server side. Wrapping
   *  the action in `async (s, e, b, f) => action(report.carrier, ...)`
   *  inside the page looked equivalent and type-checked clean, but the
   *  closure is a plain function defined in a server component and
   *  React refuses to send one across the boundary — the page rendered
   *  "Functions cannot be passed directly to Client Components". Only
   *  the `"use server"` export itself is passable, so the carrier
   *  travels as data. */
  carrier: string;
  start: string;
  end: string;
  basis: SimBasis;
  /** How many records the current window holds. Zero disables the
   *  download rather than handing over a file with a header row and
   *  nothing under it. */
  records: number;
  downloadAction: (
    carrier: string,
    start: string,
    end: string,
    basis: SimBasis,
    format: SimFormat,
  ) => Promise<FileResult>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [format, setFormat] = useState<SimFormat>("csv");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fixed-width is the schedule record layout and has no passenger,
  // cargo or mail columns. Legacy offers the combination for its
  // accounting target and drops all three silently; the service
  // refuses it with a 422. Disabling it here means the refusal is
  // visible before the click rather than as an error after it.
  const fixedUnavailable = basis === "flights";
  const effectiveFormat: SimFormat =
    fixedUnavailable && format === "fixed" ? "csv" : format;

  const go = (next: { start?: string; end?: string; basis?: SimBasis }) => {
    const q = new URLSearchParams({
      start: next.start ?? start,
      end: next.end ?? end,
      basis: next.basis ?? basis,
    });
    startTransition(() => router.push(`/reports/sim?${q}`));
  };

  const download = async () => {
    setBusy(true);
    setError(null);
    const result = await downloadAction(
      carrier,
      start,
      end,
      basis,
      effectiveFormat,
    );
    setBusy(false);
    if (result.status === "ok") {
      save(result.body, result.filename, effectiveFormat);
    } else {
      setError(result.message);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            From
          </span>
          <input
            type="date"
            aria-label="Window start"
            value={start}
            max={end}
            disabled={isPending}
            onChange={(e) => e.target.value && go({ start: e.target.value })}
            className="rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            To
          </span>
          <input
            type="date"
            aria-label="Window end"
            value={end}
            min={start}
            disabled={isPending}
            onChange={(e) => e.target.value && go({ end: e.target.value })}
            className="rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Records
          </span>
          <select
            aria-label="What to export"
            value={basis}
            disabled={isPending}
            onChange={(e) => go({ basis: e.target.value as SimBasis })}
            className="rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground"
          >
            <option value="schedule">Schedule — one per service</option>
            <option value="flights">Flights — one per departure</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Format
          </span>
          <select
            aria-label="File format"
            value={effectiveFormat}
            disabled={isPending}
            onChange={(e) => setFormat(e.target.value as SimFormat)}
            className="rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground"
          >
            {(["csv", "fixed", "xml"] as SimFormat[]).map((f) => (
              <option
                key={f}
                value={f}
                disabled={f === "fixed" && fixedUnavailable}
              >
                {FORMAT_LABEL[f]}
                {f === "fixed" && fixedUnavailable ? " — schedule only" : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={download}
          disabled={busy || isPending || records === 0}
          title={
            records === 0
              ? "Nothing to export in this window"
              : undefined
          }
          className="rounded-md bg-status-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-40"
        >
          {busy ? "Preparing…" : `Download ${FORMAT_LABEL[effectiveFormat]}`}
        </button>
      </div>
      {fixedUnavailable && (
        <p className="mt-2 text-[0.7rem] text-muted-foreground">
          The fixed-width record ends at seats — it has no passenger,
          cargo or mail fields, so a per-departure extract only goes out
          as CSV or XML.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[0.7rem] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}
