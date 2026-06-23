import Link from "next/link";

import type { FlightLogResponse } from "@/lib/api/types";

import { FLIGHT_TYPE_LABELS } from "../elog/[id]/flight-type-labels";

/**
 * Flight tab table on the My History page.
 *
 * MVP columns mirror the legacy `crew/flight_history.html` table at
 * a tighter set — what the rich elog tabs will eventually back is
 * deferred (per-leg routes, night/IFR/approaches, full edit modal).
 * Status badges piggyback on the elog page's pills so the styling is
 * consistent across surfaces.
 */
export function FlightHistoryTable({
  logs,
  fromDate,
  toDate,
}: {
  logs: FlightLogResponse[];
  fromDate: string;
  toDate: string;
}) {
  if (logs.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          No flight logs in {fromDate} → {toDate}.
        </p>
        <p className="mt-2 text-xs text-muted-foreground/80">
          Start one from{" "}
          <Link
            href="/flight-crew/elog"
            className="font-semibold text-status-blue hover:underline"
          >
            the elog landing
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-border bg-card/60 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Log #</th>
            <th className="px-3 py-2">Flight #</th>
            <th className="px-3 py-2">Tail</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 sr-only">Open</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr
              key={log.id}
              className="border-b border-border/60 last:border-b-0"
            >
              <td className="px-3 py-2 font-mono">{log.flight_date}</td>
              <td className="px-3 py-2 font-mono">{log.log_number}</td>
              <td className="px-3 py-2">{log.flight_number ?? "—"}</td>
              <td className="px-3 py-2 font-mono text-status-blue">
                {log.aircraft.tail_number}
              </td>
              <td className="px-3 py-2">
                {FLIGHT_TYPE_LABELS[log.flight_type]}
              </td>
              <td className="px-3 py-2">
                <StatusBadges log={log} />
              </td>
              <td className="px-3 py-2 text-right">
                <Link
                  href={`/flight-crew/elog/${log.id}`}
                  className="text-status-blue hover:underline"
                >
                  Open →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-border bg-card/40 text-[0.7rem]">
          <tr>
            <td colSpan={5} className="px-3 py-2 text-right text-muted-foreground">
              {logs.length} log{logs.length === 1 ? "" : "s"}
            </td>
            <td colSpan={2} className="px-3 py-2 text-muted-foreground/70">
              Filtered totals: hours roll in once Tab 2 (Legs) ships.
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function StatusBadges({ log }: { log: FlightLogResponse }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {log.status === "draft" ? (
        <span className="rounded bg-status-yellow/15 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-status-yellow">
          Draft
        </span>
      ) : (
        <span className="rounded bg-status-green/15 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-status-green">
          Submitted
        </span>
      )}
      {log.is_manual_entry && (
        <span
          title="Started without a dispatch packet"
          className="rounded border border-status-yellow/40 bg-status-yellow/10 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-status-yellow"
        >
          Manual Entry
        </span>
      )}
    </span>
  );
}
