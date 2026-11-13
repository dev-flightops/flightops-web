import Link from "next/link";

import { buttonSolid, linkCaps } from "@/components/ff/controls";
import type { BoardFlightItem } from "@/lib/api/types";
import { stopState } from "@/lib/flight-following/stops";
import { formatBoth, formatLocal, formatZulu } from "@/lib/format/flight-time";
import { flightStops } from "@/lib/route";

import { CheckInButton } from "./check-in-button";
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
 * ForeFlight's list (#78): an UPPERCASE band for the header, quiet
 * dividers, generous rows, codes in mono. An overdue row is marked by a
 * red edge down its left side and the OVERDUE status beside AIRBORNE —
 * not by tinting the whole row, which on navy read as an error state.
 */
export function FlightBoard({ flights, canDispatch = false }: { flights: BoardFlightItem[]; canDispatch?: boolean }) {
  if (flights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center border border-border bg-card py-16 text-center">
        <p className="caption-caps text-muted-foreground">No active flights</p>
        {canDispatch && <Link href="/flight-following/new" className={`${buttonSolid} mt-5`}>
          Open Flight
        </Link>}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-border bg-card" role="region" aria-label="Flight board; scroll horizontally to see all columns" tabIndex={0}>
      <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground sm:hidden">Swipe sideways for status, contact and flight actions.</p>
      <table className="w-full text-[0.8125rem]">
        <thead className="bg-muted">
          <tr className="eyebrow text-left">
            <th className="px-4 py-3 font-bold">Flight</th>
            <th className="px-4 py-3 font-bold">Aircraft</th>
            <th className="px-4 py-3 font-bold">Route</th>
            <th className="px-4 py-3 font-bold">PIC</th>
            <th className="px-4 py-3 font-bold">ETD / ATD</th>
            <th className="px-4 py-3 font-bold">ETA / ATA</th>
            <th className="px-4 py-3 font-bold">Status</th>
            <th className="px-4 py-3 font-bold">Contact</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {flights.map((f) => (
            <FlightBoardRow key={f.id} flight={f} canDispatch={canDispatch} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlightBoardRow({ flight, canDispatch }: { flight: BoardFlightItem; canDispatch: boolean }) {
  // Marked stop by stop on a multi-stop flight (LOG-14).
  const { next, inAir, atStop } = stopState(flight);
  const dep = formatBoth(flight.scheduled_departure_at);
  // Once it has left, its scheduled block after the departure (#155): MM001
  // left at 21:42Z and showed an ETA of 19:45Z.
  const arr = formatBoth(flight.estimated_arrival_at ?? flight.scheduled_arrival_at);
  const hasPax = flight.pax_count > 0 || flight.cargo_lbs > 0;

  return (
    <tr
      className={
        flight.is_overdue
          ? "border-t border-border shadow-[inset_3px_0_0_rgb(var(--status-red))] hover:bg-accent"
          : "border-t border-border hover:bg-accent"
      }
      data-overdue={flight.is_overdue ? "true" : undefined}
    >
      <td className="px-4 py-3.5 font-mono font-semibold text-foreground">
        {flight.flight_number || "—"}
      </td>
      <td className="px-4 py-3.5">
        <div className="font-mono text-foreground">
          {flight.aircraft.tail_number}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {flight.aircraft.model}
        </div>
      </td>
      <td className="px-4 py-3.5">
        <div className="font-mono text-foreground">
          {flightStops(flight).map((icao, i) => (
            <span key={`${icao}-${i}`}>
              {i > 0 && <span className="text-muted-foreground"> → </span>}
              {icao}
            </span>
          ))}
        </div>
        <StopMarks flight={flight} />
        {hasPax && (
          <div className="mt-0.5 text-xs">
            <LoadIndicator
              pax={flight.pax_count}
              seats={flight.aircraft.seats}
              cargoLbs={flight.cargo_lbs}
            />
          </div>
        )}
      </td>
      <td className="px-4 py-3.5 text-muted-foreground">
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
      <td className="px-4 py-3.5">
        <div className="flex flex-col items-start gap-1">
          <StatusBadge
            status={flight.status}
            actualDepartureAt={flight.actual_departure_at}
            atStop={atStop}
          />
          {flight.is_overdue && <OverdueBadge />}
        </div>
      </td>
      <td className="px-4 py-3.5">
        <LastContactCell iso={flight.last_contact_at} airborne={inAir} />
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 text-right">
        {canDispatch && next && (
          // A new mark is a new button: an open dialog for a mark someone
          // else just made closes with the refresh, and can't send the next.
          <CheckInButton
            key={`${next.event}-${next.leg ?? "flight"}`}
            flightId={flight.id}
            flightNumber={flight.flight_number}
            event={next.event}
            leg={next.leg}
            airport={next.airport}
            first={next.first}
            last={next.last}
          />
        )}
        {/* No Docs here: legacy's per-flight documents (`/following/{id}/docs`,
            a FlightDocument model, per-category upload permissions) don't
            exist. A dimmed "Docs" on every row read as broken (#134). */}
        {/* #132: "is there a way that we can go back in and edit a flight
            after it's made it to this stage?" The packet's Edit, opened. */}
        {canDispatch && flight.status === "scheduled" && (
          <Link href={`/dispatch?flight=${flight.id}&edit=1`} className={`mr-4 ${linkCaps}`}>
            Edit
          </Link>
        )}
        {canDispatch && <Link href={`/dispatch?flight=${flight.id}`} className={linkCaps}>
          Update <span aria-hidden>›</span>
        </Link>}
      </td>
    </tr>
  );
}

/** A multi-stop flight's marks at the stops it has reached (LOG-14):
 *  "PADM 14:50–15:12 AKST", landed and left, in the board's local time. */
function StopMarks({ flight }: { flight: BoardFlightItem }) {
  const legs = [...(flight.legs ?? [])].sort((a, b) => a.sequence - b.sequence);
  const reached = legs.slice(0, -1).flatMap((leg, i) =>
    leg.actual_arrival_at
      ? [{ icao: leg.destination, landed: leg.actual_arrival_at, left: legs[i + 1]?.actual_departure_at ?? null }]
      : [],
  );
  if (reached.length === 0) return null;
  return (
    <div className="mt-0.5 font-mono text-xs text-muted-foreground">
      {reached.map((stop) => (
        <div key={stop.icao + stop.landed}>
          {stop.left
            ? `${stop.icao} ${formatLocal(stop.landed).replace(/ \S+$/, "")}–${formatLocal(stop.left)}`
            : `${stop.icao} ${formatLocal(stop.landed)}, on the ground`}
        </div>
      ))}
    </div>
  );
}

/**
 * Load indicator — "8/9" for pax-against-seats per spec, plus cargo
 * lbs when present. Red when pax > seats (over-capacity), default
 * muted otherwise. Cargo-only flights show just the weight.
 */
function LoadIndicator({
  pax,
  seats,
  cargoLbs,
}: {
  pax: number;
  seats: number;
  cargoLbs: number;
}) {
  const overCapacity = pax > seats && seats > 0;
  return (
    <span
      className={
        overCapacity ? "font-semibold text-status-red" : "text-muted-foreground"
      }
    >
      {pax > 0 && (
        <>
          <span className="font-mono">
            {pax}/{seats > 0 ? seats : "?"}
          </span>{" "}
          pax
        </>
      )}
      {pax > 0 && cargoLbs > 0 && <span className="mx-1">·</span>}
      {cargoLbs > 0 && <span>{cargoLbs.toLocaleString()} lbs</span>}
    </span>
  );
}

/**
 * Last Contact cell — colour-coded by age per spec:
 *   <10 min       grey
 *   10–20 min     yellow
 *   >20 min       red (only when the flight is airborne)
 * On-ground or no contact yet → muted dash.
 */
function LastContactCell({
  iso,
  airborne,
}: {
  iso: string | null;
  airborne: boolean;
}) {
  if (!iso) {
    return <span className="text-muted-foreground">—</span>;
  }
  const ageMin = (Date.now() - new Date(iso).getTime()) / 60_000;
  let tone = "text-muted-foreground";
  if (airborne && ageMin > 20) tone = "font-semibold text-status-red";
  else if (ageMin >= 10) tone = "text-status-yellow";
  return <span className={`font-mono ${tone}`}>{formatZulu(iso)}</span>;
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
      <td className="px-4 py-3.5 text-status-green">
        <div className="font-mono tabular-nums">{actual.local}</div>
        <div className="mt-0.5 font-mono text-xs tabular-nums">{actual.zulu}</div>
      </td>
    );
  }
  return (
    <td className="px-4 py-3.5 text-muted-foreground">
      <div className="font-mono tabular-nums text-foreground">{scheduled.local}</div>
      <div className="mt-0.5 font-mono text-xs tabular-nums">{scheduled.zulu}</div>
    </td>
  );
}
