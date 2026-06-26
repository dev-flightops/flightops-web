import { ApiError } from "@/lib/api/client";
import { listSquawks } from "@/lib/api/maintenance";
import type { FlightLogResponse, SquawkResponse } from "@/lib/api/types";

import { MxDiscrepancyField } from "./mx-discrepancy-field";

/**
 * Tab 7 of the 7-tab elog — Spec 4 §"7-tab Electronic Flight Log /
 * Tab 7: Misc".
 *
 * Two panels mirroring legacy templates/elog/log_page.html Tab 7:
 *
 *   MX Discrepancy: textarea where the pilot describes any
 *     maintenance issues they hit during the flight. On submission
 *     the M2-M-9 auto-fire chain reads this column and creates a
 *     Maintenance work order when non-empty.
 *
 *   MX History: last 10 squawks for this tail — read-only, lets the
 *     pilot see recent open/in-progress/resolved issues so they
 *     don't double-report something already in the system.
 *
 * The Submit button + edit-history audit (M2-M-10 territory) live
 * elsewhere — Submit is the sticky header button on the page; edit
 * history ships with the audit work.
 */
export async function MiscTab({ log }: { log: FlightLogResponse }) {
  let history: SquawkResponse[] = [];
  let historyError: string | null = null;
  try {
    const response = await listSquawks({
      aircraftId: log.aircraft.id,
      limit: 10,
    });
    history = response.items;
  } catch (err) {
    historyError =
      err instanceof ApiError && err.status === 401
        ? "Sign in to see MX history."
        : "MX history unavailable. Refresh in a moment.";
  }

  return (
    <div className="space-y-4">
      <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Misc
      </h2>

      <MxDiscrepancyField
        logId={log.id}
        initialValue={log.mx_discrepancy ?? ""}
        readOnly={log.status === "submitted"}
      />

      <MxHistoryPanel
        tail={log.aircraft.tail_number}
        history={history}
        error={historyError}
      />
    </div>
  );
}

function MxHistoryPanel({
  tail,
  history,
  error,
}: {
  tail: string;
  history: SquawkResponse[];
  error: string | null;
}) {
  if (error) {
    return (
      <div
        role="alert"
        className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-4 py-2.5 text-xs text-status-yellow"
      >
        {error}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          No squawks on file for{" "}
          <span className="font-mono">{tail}</span> yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        MX History — <span className="font-mono">{tail}</span> (last 10)
      </div>
      <ul className="divide-y divide-border/40 text-xs">
        {history.map((sq) => (
          <li key={sq.id} className="flex items-center gap-3 py-1.5">
            <span className="w-12 shrink-0 font-mono text-[0.65rem] text-muted-foreground">
              {sq.reported_at.slice(5, 10)}
            </span>
            <span className="flex-1 truncate text-foreground">
              {sq.title}
            </span>
            <StatusBadge status={sq.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: SquawkResponse["status"];
}) {
  const cls =
    status === "resolved"
      ? "bg-status-green/15 text-status-green"
      : status === "open"
        ? "bg-status-red/15 text-status-red"
        : "bg-status-yellow/15 text-status-yellow";
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] ${cls}`}
    >
      {status}
    </span>
  );
}
