"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { moveFlightDayAction } from "@/app/(app)/dispatch/[flightId]/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FlightMoveResult } from "@/lib/api/ops";
import { localDate, localDateTime } from "@/lib/format/local-time";
import { bookingRef } from "@/lib/reservations/booking-ref";
import { nextDay } from "@/lib/schedule/master";

const MIN_REASON = 5;

/**
 * Move a flight that hasn't left to another day (#174).
 *
 * The client, 10/30: "There was no easy way to move the flight to the next
 * day so I cancelled the flight." A flight with stops meant retyping every
 * leg's times, and a released one pulling the release back first. Here it's
 * a date: ops moves the legs, the bookings and the fuel, takes a release
 * back, and starts over what was done for the old day.
 */
export function MoveFlightDay({
  flightId,
  flightNumber,
  departsAt,
  timeZone,
  released = false,
  defaultOpen = false,
  size = "default",
}: {
  flightId: string;
  flightNumber: string;
  /** Local at the departure base: "YYYY-MM-DDTHH:MM". */
  departsAt: string;
  timeZone: string;
  released?: boolean;
  /** Open on arrival: the schedule's link. */
  defaultOpen?: boolean;
  size?: "default" | "sm";
}) {
  const router = useRouter();
  const currentDay = departsAt.slice(0, 10);
  const [open, setOpen] = useState(defaultOpen);
  const [day, setDay] = useState(nextDay(currentDay));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [moved, setMoved] = useState<FlightMoveResult | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    if (pending) return;
    setOpen(false);
    setError(null);
    setReason("");
    setMoved(null);
    // Only now: a release taken back turns the row this button sits in into
    // another, which would take the summary with it. The schedule's link
    // comes off the address, or that other row would open again.
    if (defaultOpen) router.replace(`/dispatch?flight=${flightId}`);
    else if (moved) router.refresh();
  }

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await moveFlightDayAction(flightId, day, reason.trim());
      if (result.ok) setMoved(result.moved);
      else setError(result.error);
    });
  }

  const blocked = pending || !day || day === currentDay || (released && reason.trim().length < MIN_REASON);

  return (
    <>
      <Button type="button" variant="outline" size={size} onClick={() => setOpen(true)}>
        Move to Another Day
      </Button>
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent className="sm:max-w-lg">
          {moved ? (
            <Moved flightNumber={flightNumber} moved={moved} timeZone={timeZone} onClose={close} />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Move {flightNumber} to another day</DialogTitle>
                <DialogDescription>
                  Every leg keeps its local time. Its bookings, manifest, mail and freight, crew and
                  fuel orders stay on it. It needs its FRAT filed and signed again, fresh
                  acknowledgments and a release for the new day, and anyone checked in is booked
                  again. Passengers and crew aren&rsquo;t told automatically.
                </DialogDescription>
              </DialogHeader>
              <label htmlFor="move-day" className="field-label">
                New day
              </label>
              <input
                id="move-day"
                type="date"
                required
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="ff-input"
              />
              {released ? (
                <>
                  <label htmlFor="move-reason" className="field-label">
                    Reason
                  </label>
                  <p className="-mt-1 text-xs text-muted-foreground">
                    It&rsquo;s released, so the move takes the release back. The reason goes in the
                    flight&rsquo;s record with it.
                  </p>
                  <textarea
                    id="move-reason"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={500}
                    placeholder="e.g. Weather won't lift today; flying tomorrow"
                    className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.8125rem] focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                  />
                </>
              ) : null}
              {error ? (
                <p role="alert" className="notice notice-red">
                  {error}
                </p>
              ) : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={close} disabled={pending}>
                  Back
                </Button>
                <Button type="button" onClick={confirm} disabled={blocked}>
                  {pending ? "Moving…" : "Move Flight"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

function Moved({
  flightNumber,
  moved,
  timeZone,
  onClose,
}: {
  flightNumber: string;
  moved: FlightMoveResult;
  timeZone: string;
  onClose: () => void;
}) {
  const lines = [
    moved.release_withdrawn ? "The release was taken back." : null,
    moved.bookings_moved > 0 ? `${plural(moved.bookings_moved, "booking")} moved with it.` : null,
    moved.fuel_orders_moved > 0 ? `${plural(moved.fuel_orders_moved, "fuel order")} moved with it.` : null,
    moved.passengers_rebooked > 0
      ? `${plural(moved.passengers_rebooked, "passenger")} checked in, on board or marked a no-show ${moved.passengers_rebooked === 1 ? "is" : "are"} booked again.`
      : null,
    "It needs its FRAT filed and signed again, fresh acknowledgments and a release.",
    "Tell the passengers and the crew: nothing is sent to them.",
  ].filter((line): line is string => line !== null);
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {flightNumber} is now on {localDate(moved.flight.scheduled_departure_at, timeZone, { withYear: true })}
        </DialogTitle>
        <DialogDescription>
          {`Departs ${localDateTime(moved.flight.scheduled_departure_at, timeZone)}.`}
        </DialogDescription>
      </DialogHeader>
      <ul role="status" className="list-disc space-y-1 pl-5 text-sm">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {moved.trips_out_of_order.map((trip) => (
        <p key={trip.booking_id} role="alert" className="notice notice-yellow text-sm">
          {`${trip.customer}'s return trip is out of order: this half now leaves ${localDateTime(trip.moved_departs, timeZone)}, the other half ${localDateTime(trip.other_departs, timeZone)}. `}
          <Link
            href={`/reservations/bookings/${trip.other_booking_id}`}
            className="font-mono font-semibold underline"
          >
            {bookingRef(trip.other_booking_id)}
          </Link>
          {" needs moving too."}
        </p>
      ))}
      <DialogFooter>
        <Button type="button" onClick={onClose}>
          Done
        </Button>
      </DialogFooter>
    </>
  );
}
