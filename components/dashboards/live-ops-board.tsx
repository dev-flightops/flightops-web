import Link from "next/link";

import type { BoardFlightItem } from "@/lib/api/types";

/**
 * Live Ops Board — table of today's flights for the Executive dashboard.
 * Mirrors the legacy peregrineflight panel of the same name:
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ LIVE OPS BOARD                                              │
 *   │ FLIGHT  TAIL    ROUTE         PIC   STATUS    ETD    ETA   │
 *   │ GV303   N208GB  PADM→PABE     —     Airborne  16:33z 18:32z│
 *   │ ...                                                         │
 *   │                                          Full ops board →  │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Data is snapshot.board — already fetched. PIC is "—" until the
 * crew-service ships in M3 (BoardFlightItem.pic_name is null today).
 */

interface Props {
  board: BoardFlightItem[];
}

export function LiveOpsBoard({ board }: Props) {
  const rows = board
    .slice()
    .sort(
      (a, b) =>
        new Date(a.scheduled_departure_at).getTime() -
        new Date(b.scheduled_departure_at).getTime(),
    );

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Live Ops Board
      </h2>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No flights on today&apos;s board.
        </p>
      ) : (
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full min-w-[560px] text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="text-left text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                <th className="py-1.5 pr-3">Flight</th>
                <th className="py-1.5 pr-3">Tail</th>
                <th className="py-1.5 pr-3">Route</th>
                <th className="py-1.5 pr-3">PIC</th>
                <th className="py-1.5 pr-3">Status</th>
                <th className="py-1.5 pr-3">ETD</th>
                <th className="py-1.5 pr-3">ETA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <Row key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex justify-end border-t border-border pt-3 text-[0.65rem]">
        <Link
          href="/flight-following"
          className="text-status-blue hover:underline"
        >
          Full ops board →
        </Link>
      </div>
    </section>
  );
}

function Row({ row }: { row: BoardFlightItem }) {
  return (
    <tr className="text-foreground">
      <td className="py-1.5 pr-3 font-semibold">{row.flight_number}</td>
      <td className="py-1.5 pr-3 font-mono">{row.aircraft.tail_number}</td>
      <td className="py-1.5 pr-3 font-mono text-muted-foreground">
        {row.origin}→{row.destination}
      </td>
      <td className="py-1.5 pr-3 text-muted-foreground/60">
        {row.pic_name ?? "—"}
      </td>
      <td className="py-1.5 pr-3">
        <StatusBadge row={row} />
      </td>
      <td className="py-1.5 pr-3 font-mono">
        {fmtZulu(row.scheduled_departure_at)}
      </td>
      <td className="py-1.5 pr-3 font-mono">
        {fmtZulu(row.scheduled_arrival_at)}
      </td>
    </tr>
  );
}

function StatusBadge({ row }: { row: BoardFlightItem }) {
  if (row.is_overdue) {
    return (
      <span className="inline-flex items-center rounded bg-status-red/15 px-1.5 py-0.5 text-[0.65rem] font-semibold text-status-red">
        Overdue
      </span>
    );
  }
  if (row.status === "released" && row.actual_departure_at) {
    return (
      <span className="inline-flex items-center rounded bg-status-green/15 px-1.5 py-0.5 text-[0.65rem] font-semibold text-status-green">
        Airborne
      </span>
    );
  }
  if (row.status === "released") {
    return (
      <span className="inline-flex items-center rounded bg-status-blue/15 px-1.5 py-0.5 text-[0.65rem] font-semibold text-status-blue">
        Released
      </span>
    );
  }
  if (row.status === "completed") {
    return (
      <span className="inline-flex items-center rounded bg-muted/40 px-1.5 py-0.5 text-[0.65rem] font-semibold text-muted-foreground">
        Completed
      </span>
    );
  }
  if (row.status === "cancelled") {
    return (
      <span className="inline-flex items-center rounded bg-status-red/15 px-1.5 py-0.5 text-[0.65rem] font-semibold text-status-red">
        Cancelled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded bg-muted/30 px-1.5 py-0.5 text-[0.65rem] font-semibold text-muted-foreground">
      Planned
    </span>
  );
}

function fmtZulu(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}z`;
}
