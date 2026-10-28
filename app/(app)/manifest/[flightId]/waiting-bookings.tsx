"use client";

import Link from "next/link";
import { useActionState } from "react";

import { buttonOutline, linkCaps } from "@/components/ff/controls";
import { type Booking, bookingRef } from "@/lib/api/reservations";

import { addBookingAction, type ManifestFormState } from "./actions";

const _initial: ManifestFormState = { status: "idle", attempt: 0 };

/**
 * Bookings waiting for a flight that this one can carry (#137): no flight
 * yet, wanted on this flight's day, their airports on its route. Adding
 * one puts its passengers on this manifest.
 *
 * The client, 27 Oct: "From the manifest page I was able to find flight
 * 6969 and attempted to add the booking I created to it but could not
 * figure out how."
 */
export function WaitingBookings({
  flightId,
  bookings,
  newBookingHref,
  canAdd,
}: {
  flightId: string;
  bookings: Booking[];
  newBookingHref: string;
  canAdd: boolean;
}) {
  return (
    <section aria-label="Bookings waiting for this flight" className="mb-6 rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title">Bookings waiting for this flight</h2>
        {canAdd ? (
          <Link href={newBookingHref} className={buttonOutline}>
            + New booking on this flight
          </Link>
        ) : null}
      </div>
      {bookings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          None: no booking on this route that day is waiting for a flight.
        </p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {bookings.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <Link href={`/reservations/bookings/${b.id}`} className={linkCaps}>
                  {bookingRef(b.id)} <span aria-hidden>›</span>
                </Link>
                <span className="ml-2">
                  {b.customer.full_name} · <span className="font-mono">{b.origin_icao} → {b.destination_icao}</span> ·{" "}
                  {b.pax_count} pax · {b.status}
                </span>
                {b.passengers && b.passengers.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {b.passengers.map((p) => `${p.first_name} ${p.last_name}`.trim()).join(", ")}
                  </p>
                ) : null}
              </div>
              {canAdd ? <AddToFlight flightId={flightId} bookingId={b.id} /> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AddToFlight({ flightId, bookingId }: { flightId: string; bookingId: string }) {
  const [state, formAction, pending] = useActionState(addBookingAction, _initial);
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="flight_id" value={flightId} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <button
        type="submit"
        disabled={pending}
        className="btn-caps rounded-md bg-primary px-3 py-1.5 text-[0.72rem] text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add to this flight"}
      </button>
      {state.status === "error" && state.message ? (
        <span role="alert" className="max-w-[18rem] text-right text-[0.6875rem] text-status-red">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
