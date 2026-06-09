import type { TrackedAircraft } from "@/lib/flight-following/merge-tracked";

import { OverdueBadge, StatusBadge } from "./status-badge";

/**
 * Condensed flight table for the Split view's right pane.
 *
 * Columns mirror the legacy `#split-list` table:
 *   Aircraft (tail · type · flight#) | Route | Alt | Spd | Status
 *
 * Altitude and speed come from the latest position fix and are only
 * meaningful while the flight is airborne — for scheduled / cancelled
 * / completed rows we show "--" rather than the stale last-flight
 * numbers. The legacy does the same gate.
 *
 * Empty state collapses the column structure entirely so a narrow
 * 320px column doesn't render a header with no rows.
 */
export function TrackedAircraftTable({
  rows,
}: {
  rows: TrackedAircraft[];
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-3 text-center text-[0.7rem] text-muted-foreground/70">
        No flights match the current filter.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <table className="w-full text-[0.7rem]">
        <thead className="sticky top-0 z-[1] bg-card">
          <tr className="text-left text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            <th className="px-2.5 py-1.5">Aircraft</th>
            <th className="px-2.5 py-1.5">Route</th>
            <th className="px-2.5 py-1.5">Alt</th>
            <th className="px-2.5 py-1.5">Spd</th>
            <th className="px-2.5 py-1.5">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <TrackedAircraftRow key={row.flight.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrackedAircraftRow({ row }: { row: TrackedAircraft }) {
  const { flight, position } = row;
  // Altitude + speed only matter while airborne. For all other
  // statuses the latest fix would either be stale (completed) or
  // irrelevant (scheduled) — show "--" like the legacy.
  const isAirborne = flight.status === "released";
  const altitude =
    isAirborne && position?.altitude_ft !== null
      ? position?.altitude_ft?.toLocaleString()
      : null;
  const speed =
    isAirborne && position?.groundspeed_kt && position.groundspeed_kt > 0
      ? `${position.groundspeed_kt} kt`
      : null;

  return (
    <tr
      className={
        flight.is_overdue
          ? "border-t border-border bg-status-red/[0.06]"
          : "border-t border-border hover:bg-muted/20"
      }
    >
      <td className="px-2.5 py-2 align-top">
        <div className="font-mono text-[0.75rem] font-semibold text-foreground">
          {flight.aircraft.tail_number}
        </div>
        <div className="text-[0.6rem] text-muted-foreground">
          {flight.aircraft.model}
        </div>
        {flight.flight_number && (
          <div className="text-[0.6rem] text-status-blue">
            {flight.flight_number}
          </div>
        )}
      </td>
      <td className="px-2.5 py-2 align-top font-mono">
        {flight.origin}
        <span className="text-muted-foreground"> → </span>
        {flight.destination}
      </td>
      <td className="px-2.5 py-2 align-top font-mono text-muted-foreground">
        {altitude ?? "--"}
      </td>
      <td className="px-2.5 py-2 align-top font-mono text-muted-foreground">
        {speed ?? "--"}
      </td>
      <td className="px-2.5 py-2 align-top">
        <div className="flex flex-wrap items-center gap-1">
          <StatusBadge status={flight.status} />
          {flight.is_overdue && <OverdueBadge />}
        </div>
      </td>
    </tr>
  );
}
