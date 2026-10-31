import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
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
      <div className="rounded-lg border border-border bg-card px-5 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          No flight logs in {fromDate} → {toDate}.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Start one from{" "}
          <Link
            href="/flight-crew/elog"
            className="font-semibold text-primary hover:underline"
          >
            the elog landing
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-left text-xs">
        <thead className="ff-thead">
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
              className="border-b border-border transition-colors last:border-b-0 hover:bg-accent/40"
            >
              <td className="px-3 py-2 font-mono">{log.flight_date}</td>
              <td className="px-3 py-2 font-mono">{log.log_number}</td>
              <td className="px-3 py-2">{log.flight_number ?? "—"}</td>
              <td className="px-3 py-2 font-mono text-foreground">
                {log.aircraft.tail_number}
              </td>
              <td className="px-3 py-2">
                {FLIGHT_TYPE_LABELS[log.flight_type]}
              </td>
              <td className="px-3 py-2">
                <StatusBadges log={log} />
              </td>
              <td className="px-3 py-2 text-right">
                <Link href={`/flight-crew/elog/${log.id}`} className={linkCaps}>
                  Open <span aria-hidden>›</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-border bg-muted/60 text-[0.7rem]">
          <tr>
            <td colSpan={5} className="px-3 py-2 text-right text-muted-foreground">
              {logs.length} log{logs.length === 1 ? "" : "s"}
            </td>
            <td colSpan={2} className="px-3 py-2 text-muted-foreground">
              Hours are on each log’s legs.
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
        <span className="status-mark text-status-yellow">
          Draft
        </span>
      ) : (
        <span className="status-mark text-status-green">
          Submitted
        </span>
      )}
      {log.is_manual_entry && (
        <span
          title="Started without a dispatch packet"
          className="status-mark text-status-yellow"
        >
          Manual Entry
        </span>
      )}
    </span>
  );
}
