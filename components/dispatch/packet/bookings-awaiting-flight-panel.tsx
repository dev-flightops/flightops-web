import Link from "next/link";

import type { BookingFlight } from "@/lib/api/booking-flights";
import type { Booking } from "@/lib/api/reservations";
import { DEFAULT_ZONE_TABLE, localClock, localDateTime, type ZoneTable, zoneFor } from "@/lib/format/local-time";

import { BookingFlightOffers } from "./booking-flight-offers";

/**
 * Reservations nobody has put on a flight yet.
 *
 * Client bug report 8/28: "if a new booking is made, how does dispatch
 * know they need to make a new flight to service that reservation?"
 * They didn't. A booking could be taken and then sit there — the
 * assignment endpoint existed, nothing surfaced the ones still
 * waiting, and nothing told dispatch a new one had arrived.
 *
 * Same shape as the weight-returns panel above it, and for the same
 * reason: this is work that does not move until a dispatcher acts on
 * it, so it sits above the packet rather than being one more thing to
 * scroll past. Renders nothing when the queue is empty.
 *
 * Amber rather than red. A flight handed back over weight is blocked;
 * a booking without a flight is behind. Colouring them alike would
 * make the first easier to miss.
 */
export function BookingsAwaitingFlightPanel({
  bookings,
  earlier = 0,
  earlierBookings = [],
  zones = DEFAULT_ZONE_TABLE,
  offers = {},
}: {
  /** Waiting from the company's today on. */
  bookings: Booking[];
  /** The flights each could go on (LOG-05), by booking id; a booking
   *  without an entry is offered none. */
  offers?: Record<string, BookingFlight[]>;
  /** How many wait from earlier days, folded away (#134): oldest first,
   *  seventeen from the week before buried the one booked that morning.
   *  Not out of sight (#174): a flight cancelled the day after it was due
   *  puts its passengers here, and with nothing waiting today the panel
   *  didn't render, which is the client's "didn't show back up". */
  earlier?: number;
  /** The first of them, to open from the fold. */
  earlierBookings?: Booking[];
  /** Base zones: a booking's day is the day at its departure base. */
  zones?: ZoneTable;
}) {
  if (bookings.length === 0 && earlier === 0) return null;

  // A white card like every other list; the amber stays on the label and
  // count, where it says "waiting". Washing all fourteen rows in it made
  // a routine queue read as a warning.
  return (
    <section
      aria-label="Bookings awaiting a flight"
      className="mt-3 overflow-hidden rounded-lg border border-border bg-card"
    >
      <header className="flex items-center justify-between border-b border-border bg-muted/60 px-4 py-2.5">
        <h2 className="panel-title flex items-center gap-2">
          <span aria-hidden className="h-1.5 w-1.5 bg-status-yellow" />
          Awaiting a flight
        </h2>
        <span className="font-display text-lg font-extrabold tabular-nums text-status-yellow">
          {bookings.length || earlier}
        </span>
      </header>

      {bookings.length > 0 ? (
        <ul className="divide-y divide-border">
          {bookings.map((b) => (
            <BookingRow key={b.id} booking={b} zones={zones} offers={offers[b.id]} />
          ))}
        </ul>
      ) : null}

      {bookings.length > 0 ? (
        <p className="border-t border-border px-4 py-2 text-[0.65rem] text-muted-foreground">
          Place one on a flight it fits, open it to choose another, or build a flight for it here.
        </p>
      ) : null}

      {earlier > 0 ? (
        <details className="border-t border-border">
          <summary className="cursor-pointer px-4 py-2 text-[0.65rem] text-muted-foreground">
            {`${earlier} ${bookings.length > 0 ? "more " : ""}${earlier === 1 ? "is" : "are"} from earlier days: check Reservations to rebook or cancel ${earlier === 1 ? "it" : "them"}.`}
          </summary>
          <ul className="divide-y divide-border">
            {earlierBookings.map((b) => (
              <BookingRow key={b.id} booking={b} zones={zones} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function BookingRow({ booking: b, zones, offers }: { booking: Booking; zones: ZoneTable; offers?: BookingFlight[] }) {
  const zone = zoneFor(zones, b.origin_icao);
  return (
    <li className="px-4 py-3 text-xs hover:bg-accent">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <Link
          href={`/reservations/bookings/${b.id}`}
          className="font-semibold text-foreground underline-offset-2 hover:underline"
        >
          {b.customer.full_name}
        </Link>
        <span className="tabular-nums text-muted-foreground">
          {/* Local at its departure base (#174): the first ten characters
              were the UTC day, so a 15:00 booking in Alaska read as
              tomorrow's. */}
          {localDateTime(b.requested_departure_at, zoneFor(zones, b.origin_icao))}
        </span>
      </div>
      <p className="mt-0.5 text-muted-foreground">
        {b.origin_icao} → {b.destination_icao} ·{" "}
        {b.pax_count} pax
      </p>
      {offers ? (
        <BookingFlightOffers
          bookingId={b.id}
          offers={offers}
          clock={Object.fromEntries(offers.map((o) => [o.flight_id, localClock(o.departs_at, zone)]))}
        />
      ) : null}
    </li>
  );
}
