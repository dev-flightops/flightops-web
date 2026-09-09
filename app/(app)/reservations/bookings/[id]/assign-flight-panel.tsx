"use client";

import Link from "next/link";
import { useState } from "react";

import type { FlightSearchResult } from "@/lib/api/flight-search";

import { assignFlightAction } from "./actions";

/**
 * Put a booking on a flight.
 *
 * Reported 8/28: "After I've built the reservation, I don't see how to
 * assign or build a flight that can service that reservation." The
 * endpoint and the seat-aware flight search had both been here since
 * M3; nothing on screen called either, so a reservation was a
 * dead end.
 *
 * Candidates come from the same search the booking desk uses, so
 * availability here and availability there cannot disagree — seats are
 * counted on the server, never in the page.
 *
 * Unavailable flights are listed rather than hidden, with the reason
 * attached. A dispatcher looking at an unserviced booking needs to see
 * that the 09:15 exists and is full; an empty list reads as "no
 * flights that day", which is a different problem with a different
 * answer.
 *
 * Whether a flight can be assigned comes from the server's
 * `is_available`, never from comparing seat counts here. That is the
 * rule lib/api/flight-search.ts states in its own docstring, and
 * breaking it showed immediately: a completed flight was offered as
 * assignable with "9 seats free" and the assignment was refused with
 * `flight_not_assignable_in_status_completed`. Seats were never the
 * only reason a flight cannot take a booking.
 */
/** Why a flight cannot take this booking, in the reader's terms. */
function unavailableLabel(f: FlightSearchResult, paxCount: number): string {
  if (f.unavailable_reason === "already_departed") return "already departed";
  if (f.unavailable_reason === "insufficient_seats") {
    return `full — ${f.seats_available} of ${paxCount} seats`;
  }
  // A reason the server added and this page has not learned yet. Say
  // that rather than inventing one, and keep it unselectable.
  return "not available";
}

export function AssignFlightPanel({
  bookingId,
  candidates,
  assignedFlightNumber,
  paxCount,
}: {
  bookingId: string;
  candidates: FlightSearchResult[];
  assignedFlightNumber: string | null;
  paxCount: number;
}) {
  const [selected, setSelected] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function assign(flightId: string) {
    setPending(true);
    setMessage(null);
    const result = await assignFlightAction(bookingId, flightId);
    setFailed(result.status === "error");
    setMessage(
      result.status === "error"
        ? (result.message ?? "That did not work.")
        : "Assigned. The booking is off the dispatch queue.",
    );
    setPending(false);
  }

  return (
    <section
      aria-label="Flight assignment"
      className="mb-6 rounded-lg border border-border bg-card p-5"
    >
      <h2 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Flight
      </h2>

      {assignedFlightNumber ? (
        <p className="text-sm">
          On <span className="font-semibold">{assignedFlightNumber}</span>.
          {/* Moving is the same operation as assigning, so the list
              stays available rather than hiding behind an edit mode. */}
          <span className="text-muted-foreground">
            {" "}
            Choose another below to move it.
          </span>
        </p>
      ) : (
        <p className="text-sm text-status-yellow">
          Not on a flight yet — this booking is waiting on dispatch.
        </p>
      )}

      {message ? (
        <p
          role={failed ? "alert" : "status"}
          className={
            "mt-2 rounded-md px-3 py-1.5 text-xs " +
            (failed
              ? "bg-status-red/10 text-status-red"
              : "bg-status-green/10 text-status-green")
          }
        >
          {message}
        </p>
      ) : null}

      {candidates.length === 0 ? (
        <div className="mt-3 rounded-md border border-border bg-background px-3 py-3 text-xs text-muted-foreground">
          <p>No flights scheduled on this route that day.</p>
          {/* The other half of the report: "how does dispatch know they
              need to make a new flight?" When there is nothing to
              assign to, the answer is to build one, so the page says so
              and links there. */}
          <Link
            href="/dispatch"
            className="mt-1.5 inline-block font-semibold text-status-blue hover:underline"
          >
            Build a flight for it →
          </Link>
        </div>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {candidates.map((f) => {
            const blocked = !f.is_available;
            return (
              <li
                key={f.flight_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2"
              >
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="radio"
                    name="candidate-flight"
                    value={f.flight_id}
                    checked={selected === f.flight_id}
                    onChange={() => setSelected(f.flight_id)}
                    disabled={blocked || pending}
                  />
                  <span className="font-semibold">{f.flight_number}</span>
                  <span className="text-muted-foreground">
                    {f.origin} → {f.destination}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {new Date(f.scheduled_departure_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </label>
                <span
                  className={
                    "text-[0.65rem] " +
                    (blocked ? "text-status-red" : "text-muted-foreground")
                  }
                >
                  {blocked
                    ? unavailableLabel(f, paxCount)
                    : `${f.seats_available} seats free`}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {candidates.length > 0 ? (
        <button
          type="button"
          onClick={() => void assign(selected)}
          disabled={!selected || pending}
          className="mt-3 rounded-md bg-status-blue px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-40"
        >
          {pending ? "Assigning…" : "Assign to flight"}
        </button>
      ) : null}
    </section>
  );
}
