import Link from "next/link";

import type { Booking } from "@/lib/api/reservations";

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
}: {
  bookings: Booking[];
}) {
  if (bookings.length === 0) return null;

  return (
    <section
      aria-label="Bookings awaiting a flight"
      className="mt-3 rounded-xl border border-status-yellow/40 bg-status-yellow/5"
    >
      <header className="flex items-center justify-between border-b border-status-yellow/20 px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-status-yellow">
          Awaiting a flight
        </h2>
        <span className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-2 py-0.5 text-xs font-semibold text-status-yellow">
          {bookings.length}
        </span>
      </header>

      <ul className="divide-y divide-status-yellow/10">
        {bookings.map((b) => (
          <li key={b.id} className="px-4 py-3 text-xs">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <Link
                href={`/reservations/bookings/${b.id}`}
                className="font-semibold text-foreground underline-offset-2 hover:underline"
              >
                {b.customer.full_name}
              </Link>
              <span className="tabular-nums text-muted-foreground">
                {/* Read from the ISO string rather than parsed — a
                    bare date through new Date() lands at UTC midnight
                    and renders a day early west of Greenwich, which is
                    the calendar-arrow bug from 8/24. */}
                {b.requested_departure_at.slice(0, 10)}
              </span>
            </div>
            <p className="mt-0.5 text-muted-foreground">
              {b.origin_icao} → {b.destination_icao} ·{" "}
              {b.pax_count} pax
            </p>
          </li>
        ))}
      </ul>

      <p className="border-t border-status-yellow/20 px-4 py-2 text-[0.65rem] text-muted-foreground">
        Open a booking to put it on an existing flight, or build one for
        it here.
      </p>
    </section>
  );
}
