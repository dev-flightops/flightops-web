"use client";

import { useState, useTransition } from "react";

import { buttonOutline } from "@/components/ff/controls";
import type { BookingFlight } from "@/lib/api/booking-flights";

import { placeBookingAction } from "./place-booking-actions";

function lbs(v: string | null): string {
  return v == null ? "payload not on file" : `${Math.round(Number(v)).toLocaleString()} lb left`;
}

/**
 * The flights a waiting booking could go on (LOG-05, 8/28: "if it's one
 * person from PAHP to PABE, and there's an open seat on the flight it
 * would be assigned"), each placed with one click. Up to the first three
 * that fit; when none does, says so.
 */
export function BookingFlightOffers({
  bookingId,
  offers,
  clock,
}: {
  bookingId: string;
  offers: BookingFlight[];
  /** The leg's departure, as the base reads it, per flight id. */
  clock: Record<string, string>;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fitting = offers.filter((o) => o.fits).slice(0, 3);
  if (fitting.length === 0) {
    return (
      <p className="mt-1 text-[0.65rem] text-muted-foreground">
        {offers.length === 0
          ? "No flight that day on its route: build one for it."
          : "No flight that day on its route has room for it: build one, or open it to choose."}
      </p>
    );
  }
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      {fitting.map((o) => (
        <button
          key={o.flight_id}
          type="button"
          disabled={pending}
          className={`${buttonOutline} px-2 py-1 text-[0.65rem]`}
          onClick={() => {
            setError(null);
            start(async () => {
              const result = await placeBookingAction(bookingId, o.flight_id);
              if (!result.ok) setError(result.message);
            });
          }}
        >
          {`Place on ${o.flight_number}`}
          <span className="ml-1 font-normal normal-case text-muted-foreground">
            {`${clock[o.flight_id] ?? ""} · ${o.seats_available} seats · ${lbs(o.payload_left_lbs)}`}
          </span>
        </button>
      ))}
      {error ? (
        <span role="alert" className="text-[0.65rem] text-status-red">
          {error}
        </span>
      ) : null}
    </div>
  );
}
