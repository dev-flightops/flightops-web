import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import { StatusMark } from "@/components/ff/status-mark";
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
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <h2 className="panel-title border-b border-border px-5 py-3">Live Ops Board</h2>

      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          No flights on today&apos;s board.
        </p>
      ) : (
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full min-w-[560px] text-xs">
            <thead className="ff-thead sticky top-0">
              <tr>
                <th className="px-5 py-2">Flight</th>
                <th className="py-2 pr-3">Tail</th>
                <th className="py-2 pr-3">Route</th>
                <th className="py-2 pr-3">PIC</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">ETD</th>
                <th className="py-2 pr-5">ETA</th>
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

      <div className="flex justify-end border-t border-border px-5 py-3">
        <Link href="/flight-following" className={linkCaps}>
          Full ops board <span aria-hidden>›</span>
        </Link>
      </div>
    </section>
  );
}

function Row({ row }: { row: BoardFlightItem }) {
  return (
    <tr className="text-foreground transition-colors hover:bg-accent/40">
      <td className="px-5 py-2 font-mono font-semibold">{row.flight_number}</td>
      <td className="py-2 pr-3 font-mono">{row.aircraft.tail_number}</td>
      <td className="py-2 pr-3 font-mono text-muted-foreground">
        {row.origin}→{row.destination}
      </td>
      <td className="py-2 pr-3 text-muted-foreground">
        {row.pic_name ?? "—"}
      </td>
      <td className="py-2 pr-3">
        <StatusBadge row={row} />
      </td>
      <td className="py-2 pr-3 font-mono">
        {fmtZulu(row.scheduled_departure_at)}
      </td>
      <td className="py-2 pr-5 font-mono">
        {fmtZulu(row.scheduled_arrival_at)}
      </td>
    </tr>
  );
}

function StatusBadge({ row }: { row: BoardFlightItem }) {
  // A quiet mark (#82): the status in its colour behind a square.
  if (row.is_overdue) return <StatusMark label="Overdue" tone="red" />;
  if (row.status === "released" && row.actual_departure_at) {
    return <StatusMark label="Airborne" tone="green" />;
  }
  if (row.status === "released") return <StatusMark label="Released" tone="blue" />;
  if (row.status === "completed") return <StatusMark label="Completed" tone="muted" />;
  if (row.status === "cancelled") return <StatusMark label="Cancelled" tone="red" />;
  return <StatusMark label="Planned" tone="muted" />;
}

function fmtZulu(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}z`;
}
