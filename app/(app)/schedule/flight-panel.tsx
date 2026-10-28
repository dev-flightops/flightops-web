"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { buttonOutline, buttonSolid, linkCaps } from "@/components/ff/controls";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { bookingRef, type FlightBookings } from "@/lib/api/reservations";

import { flightBookingsAction } from "./actions";

export interface PanelFlight {
  id: string;
  flightNumber: string;
  stops: string[];
  /** "Oct 27, 09:39 AKDT" at the departure base. */
  departs: string;
  /** The departure as the booking form takes it: local YYYY-MM-DDTHH:MM. */
  departsLocal: string;
  tail: string;
}

/**
 * A flight on the schedule, opened (#137).
 *
 * The client, 27 Oct: "No way to adjust the manifest from the schedule
 * board. Need to be able to click on the scheduled flight and build out
 * the manifest", and an agent at any base should "look at the schedule,
 * click on the flight, see if there is an open seat available and add
 * their booking to the flight which will auto adjust the manifest". So
 * the flight number opens its legs and seats, its bookings by number with
 * their passengers, and the way to add a booking or open the manifest.
 */
export function FlightPanel({ flight }: { flight: PanelFlight }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<FlightBookings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setError(null);
      start(async () => {
        const result = await flightBookingsAction(flight.id);
        if (result.ok) setData(result.data);
        else setError(result.message);
      });
    }
  }

  const addBooking = new URLSearchParams({
    flight: flight.id,
    origin: flight.stops[0] ?? "",
    destination: flight.stops[1] ?? "",
    date: flight.departsLocal,
    pax: "1",
    return_to: `/manifest/${flight.id}`,
  });

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="font-mono font-semibold text-foreground underline decoration-dotted underline-offset-4 hover:text-primary"
        aria-label={`Open flight ${flight.flightNumber}`}
      >
        {flight.flightNumber}
      </button>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="overflow-y-auto p-6 sm:max-w-lg">
          <SheetTitle>Flight {flight.flightNumber}</SheetTitle>
          <SheetDescription>
            <span className="font-mono">{flight.stops.join(" → ")}</span> · departs {flight.departs} ·{" "}
            <span className="font-mono">{flight.tail}</span>
          </SheetDescription>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/reservations/bookings/new?${addBooking.toString()}`} className={buttonSolid}>
              + Add booking
            </Link>
            <Link href={`/manifest/${flight.id}`} className={buttonOutline}>
              Open manifest
            </Link>
            <Link
              href={`/schedule/${flight.id}/manifest`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonOutline}
            >
              Print
            </Link>
          </div>

          {pending && !data ? (
            <p role="status" className="mt-6 text-sm text-muted-foreground">
              Loading the flight&apos;s bookings…
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="notice notice-red mt-6 text-sm">
              {error}
            </p>
          ) : null}

          {data ? (
            <>
              <section aria-label="Seats" className="mt-6">
                <div className="eyebrow">Seats · {data.seats_total || "?"} on the aircraft</div>
                <ul className="mt-2 divide-y divide-border text-sm">
                  {data.legs.map((leg, i) => (
                    <li key={i} className="flex justify-between py-1.5">
                      <span className="font-mono">
                        {leg.origin} → {leg.destination}
                      </span>
                      <span>
                        {leg.held} booked ·{" "}
                        <span className="font-semibold">
                          {leg.open === null ? "seats not recorded" : `${leg.open} open`}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section aria-label="Bookings" className="mt-6">
                <div className="eyebrow">
                  Bookings · {data.bookings.length}
                </div>
                {data.bookings.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No bookings on this flight yet.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-border text-sm">
                    {data.bookings.map((b) => (
                      <li key={b.id} className="py-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <Link href={`/reservations/bookings/${b.id}`} className={linkCaps}>
                            {bookingRef(b.id)} <span aria-hidden>›</span>
                          </Link>
                          <span className="text-muted-foreground">
                            {b.customer.full_name} · <span className="font-mono">{b.origin_icao} → {b.destination_icao}</span>{" "}
                            · {b.pax_count} pax · {b.status}
                          </span>
                        </div>
                        {b.passengers.length > 0 ? (
                          <ul className="mt-1 text-xs">
                            {b.passengers.map((p) => (
                              <li key={p.id}>
                                {p.first_name} {p.last_name}
                                {p.notes ? <span className="text-muted-foreground"> · {p.notes}</span> : null}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Not named yet: adding it on the manifest puts its seats there.
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
