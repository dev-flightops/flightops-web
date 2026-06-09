import Link from "next/link";

import type { BoardFlightItem } from "@/lib/api/types";
import { formatBoth, formatZulu } from "@/lib/format/flight-time";

import { OverdueBadge, StatusBadge } from "./status-badge";

/**
 * Flight Following board table — the List-view body (M2-G-11).
 *
 * One row per flight in the active day-window filter. Columns mirror
 * the legacy `templates/flight_following/partials/board_rows.html`:
 *
 *   FLIGHT | AIRCRAFT (tail / type) | ROUTE (orig→dest / pax · cargo)
 *          | PIC | ETD/ATD | ETA/ATA | STATUS | CONTACT | actions
 *
 * Time columns show both AKD field-local and Zulu — the two clocks
 * dispatchers actually use. Actual times (ATD / ATA) ship with the
 * Check-In flow in M2-G-11b; for now we always show the scheduled
 * value in the muted style and reserve the green-emphasis style for
 * when actuals start arriving.
 *
 * Overdue rows get a soft red row tint and the OVERDUE pill next to
 * AIRBORNE, matching the legacy attention pattern.
 *
 * Empty state matches the legacy panel: faint plane glyph + CTA.
 */
export function FlightBoard({ flights }: { flights: BoardFlightItem[] }) {
  if (flights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 py-16 text-center">
        <div className="mb-3 text-3xl opacity-20" aria-hidden>
          &#9992;
        </div>
        <p className="text-sm text-muted-foreground">No active flights.</p>
        <Link
          href="/flight-following/new"
          className="mt-4 rounded-md bg-status-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
        >
          + Open Flight
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-xs">
        <thead className="bg-muted/30">
          <tr className="text-left text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <th className="px-3 py-2">Flight</th>
            <th className="px-3 py-2">Aircraft</th>
            <th className="px-3 py-2">Route</th>
            <th className="px-3 py-2">PIC</th>
            <th className="px-3 py-2">ETD / ATD</th>
            <th className="px-3 py-2">ETA / ATA</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Contact</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {flights.map((f) => (
            <FlightBoardRow key={f.id} flight={f} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlightBoardRow({ flight }: { flight: BoardFlightItem }) {
  const dep = formatBoth(flight.scheduled_departure_at);
  const arr = formatBoth(flight.scheduled_arrival_at);
  const hasPax = flight.pax_count > 0 || flight.cargo_lbs > 0;

  return (
    <tr
      className={
        flight.is_overdue
          ? "border-t border-border bg-status-red/[0.06] hover:bg-status-red/[0.1]"
          : "border-t border-border hover:bg-muted/20"
      }
    >
      <td className="px-3 py-2.5 font-semibold text-foreground">
        {flight.flight_number || "—"}
      </td>
      <td className="px-3 py-2.5">
        <div className="font-mono text-foreground">
          {flight.aircraft.tail_number}
        </div>
        <div className="text-[0.65rem] text-muted-foreground">
          {flight.aircraft.model}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="font-mono text-foreground">
          {flight.origin}{" "}
          <span className="text-muted-foreground">→</span> {flight.destination}
        </div>
        {hasPax && (
          <div className="text-[0.65rem] text-muted-foreground">
            {flight.pax_count} pax
            {flight.cargo_lbs > 0 && ` · ${flight.cargo_lbs} lbs`}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">
        {flight.pic_name ?? "—"}
      </td>
      <ScheduledActualCell
        scheduled={dep}
        actualIso={flight.actual_departure_at}
      />
      <ScheduledActualCell
        scheduled={arr}
        actualIso={flight.actual_arrival_at}
      />
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1">
          <StatusBadge status={flight.status} />
          {flight.is_overdue && <OverdueBadge />}
        </div>
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">
        {flight.last_contact_at ? formatZulu(flight.last_contact_at) : "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right">
        <Link
          href={`/flight-following/${flight.id}/check-in`}
          className="mr-3 text-[0.7rem] font-medium text-status-green hover:underline"
        >
          Check In
        </Link>
        <Link
          href={`/flight-following/${flight.id}/docs`}
          className="mr-3 text-[0.7rem] font-medium text-muted-foreground hover:underline"
        >
          Docs
        </Link>
        <Link
          href={`/dispatch?flight=${flight.id}`}
          className="text-[0.7rem] font-medium text-status-blue hover:underline"
        >
          Update →
        </Link>
      </td>
    </tr>
  );
}

/** ETD/ATD or ETA/ATA cell. Shows the scheduled time muted; when an
 *  actual time arrives (post M2-G-11b Check-In) it takes over in the
 *  emphasized green colour the legacy uses for known-good times. */
function ScheduledActualCell({
  scheduled,
  actualIso,
}: {
  scheduled: { local: string; zulu: string };
  actualIso: string | null;
}) {
  if (actualIso !== null) {
    const actual = formatBoth(actualIso);
    return (
      <td className="px-3 py-2.5 text-status-green">
        <div className="font-mono">{actual.local}</div>
        <div className="font-mono text-[0.65rem] opacity-80">{actual.zulu}</div>
      </td>
    );
  }
  return (
    <td className="px-3 py-2.5 text-muted-foreground">
      <div className="font-mono">{scheduled.local}</div>
      <div className="font-mono text-[0.65rem] opacity-80">
        {scheduled.zulu}
      </div>
    </td>
  );
}
