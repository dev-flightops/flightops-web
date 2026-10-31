import Link from "next/link";

import { buttonSolid, linkCaps } from "@/components/ff/controls";
import type { BoardFlightItem } from "@/lib/api/types";
import { formatBoth, formatZulu } from "@/lib/format/flight-time";
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
export function FlightBoard({ flights }: { flights: BoardFlightItem[] }) {
  if (flights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center border border-border bg-card py-16 text-center">
        <p className="caption-caps text-muted-foreground">No active flights</p>
        <Link href="/flight-following/new" className={`${buttonSolid} mt-5`}>
          Open Flight
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-border bg-card">
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
            <FlightBoardRow key={f.id} flight={f} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlightBoardRow({ flight }: { flight: BoardFlightItem }) {
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
          />
          {flight.is_overdue && <OverdueBadge />}
        </div>
      </td>
      <td className="px-4 py-3.5">
        <LastContactCell
          iso={flight.last_contact_at}
          airborne={
            flight.status === "released" &&
            flight.actual_departure_at !== null &&
            flight.actual_arrival_at === null
          }
        />
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 text-right">
        {flight.status === "released" && flight.actual_departure_at === null && (
          <CheckInButton flightId={flight.id} flightNumber={flight.flight_number} event="depart" />
        )}
        {flight.status === "released" && flight.actual_departure_at !== null && (
          <CheckInButton flightId={flight.id} flightNumber={flight.flight_number} event="arrive" />
        )}
        {/* Dimmed rather than linked. There is no per-flight document
            page: legacy has one at `/following/{id}/docs`, backed by a
            FlightDocument model, per-category upload permissions and a
            download route, and none of that exists here — so this link
            404'd on every row of the board.
            Dimming is the reversible half of an open decision about
            whether to build the subsystem or drop the affordance. What
            is not in question is that a link to a 404 is worse than
            either. */}
        <span
          title="Per-flight documents are not built yet"
          aria-disabled="true"
          className="mr-4 cursor-not-allowed text-[0.68rem] font-bold uppercase tracking-[0.1em] text-muted-foreground/40"
        >
          Docs
        </span>
        {/* #132: "is there a way that we can go back in and edit a flight
            after it's made it to this stage?" The packet's Edit, opened. */}
        {flight.status === "scheduled" && (
          <Link href={`/dispatch?flight=${flight.id}&edit=1`} className={`mr-4 ${linkCaps}`}>
            Edit
          </Link>
        )}
        <Link href={`/dispatch?flight=${flight.id}`} className={linkCaps}>
          Update <span aria-hidden>›</span>
        </Link>
      </td>
    </tr>
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
