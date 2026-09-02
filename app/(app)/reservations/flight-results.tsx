import Link from "next/link";

import {
  type FlightSearchResponse,
  type FlightSearchResult,
  type UnavailableReason,
} from "@/lib/api/flight-search";

/**
 * Why a listed flight cannot be booked, in words a dispatcher can act
 * on.
 *
 * Defined here rather than imported from the api module: importing a
 * runtime value from `lib/api/*` pulls apiFetch -> next-auth ->
 * next/server into any unit test of this file. The type import above is
 * erased at compile time, so the reason set still cannot drift from the
 * backend's.
 */
const UNAVAILABLE_REASON_LABELS: Record<UnavailableReason, string> = {
  insufficient_seats: "Not enough seats",
  already_departed: "Already departed",
};

/**
 * Results of a flight search.
 *
 * Hook-free and free of `next/*` runtime imports so it can be unit
 * tested — the same reason portal-ui.tsx and key-table.tsx are split
 * out. Bookability comes from the backend's `is_available`; this file
 * never re-derives it from the seat numbers, because two
 * implementations of one rule drift and only the server's is enforced.
 */

export function FlightResults({
  results,
  bookingHref,
}: {
  results: FlightSearchResponse;
  /** Where "Book" goes for a given flight. Injected so this file stays
   *  free of route-building concerns. */
  bookingHref: (flight: FlightSearchResult) => string;
}) {
  if (results.total === 0) {
    return (
      <div
        role="status"
        className="mt-4 rounded-lg border border-border bg-card p-4"
      >
        <p className="text-sm font-semibold text-foreground">
          No flights available
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Nothing on {results.origin} → {results.destination} on{" "}
          {formatDay(results.search_date)} can take{" "}
          {results.pax_count === 1
            ? "1 passenger"
            : `${results.pax_count} passengers`}
          . Try another date, or file the booking manually and assign a
          flight later.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {/* Captioned with the search that actually ran, not what is
          currently typed — the two diverge as soon as someone edits the
          form without re-searching. */}
      <p className="mb-2 text-xs text-muted-foreground">
        {results.total} flight{results.total === 1 ? "" : "s"} ·{" "}
        {results.origin} → {results.destination} ·{" "}
        {formatDay(results.search_date)} · {results.pax_count} pax
      </p>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[0.65rem] uppercase tracking-[0.06em] text-muted-foreground">
              <th className="px-4 py-3">Flight</th>
              <th className="px-4 py-3">Departs</th>
              <th className="px-4 py-3">Aircraft</th>
              <th className="px-4 py-3">Seats</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {results.items.map((f) => (
              <tr
                key={f.flight_id}
                className={`border-b border-border/60 last:border-0 ${
                  f.is_available ? "" : "opacity-60"
                }`}
              >
                <td className="px-4 py-3 font-mono text-foreground">
                  {f.flight_number}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatTime(f.scheduled_departure_at)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {f.aircraft_tail ?? "TBA"}
                  {f.aircraft_model ? (
                    <span className="ml-1 text-xs">({f.aircraft_model})</span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <SeatCount flight={f} />
                </td>
                <td className="px-4 py-3 text-right">
                  {f.is_available ? (
                    <Link
                      href={bookingHref(f)}
                      className="rounded-md bg-status-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
                    >
                      Book
                    </Link>
                  ) : (
                    <span className="text-xs text-status-yellow">
                      {f.unavailable_reason
                        ? UNAVAILABLE_REASON_LABELS[f.unavailable_reason]
                        : "Unavailable"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Seats free out of total. Shown even on unbookable rows: a departed
 *  flight with empty seats is a different problem from a full one, and
 *  the dispatcher needs to tell them apart. */
function SeatCount({ flight }: { flight: FlightSearchResult }) {
  const tone =
    flight.seats_available === 0
      ? "text-status-red"
      : flight.seats_available <= 2
        ? "text-status-yellow"
        : "text-status-green";
  return (
    <span className="tabular-nums">
      <span className={`font-semibold ${tone}`}>{flight.seats_available}</span>
      <span className="text-muted-foreground"> / {flight.seats_total}</span>
    </span>
  );
}

/** "2026-08-20" → "Aug 20, 2026". Parsed as a calendar date, not a
 *  timestamp: `new Date("2026-08-20")` is UTC midnight and renders as
 *  the 19th west of Greenwich, which is every station here. */
export function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    // The parse above is already UTC; without this the UTC-midnight
    // instant is then rendered in the host's zone and rolls back a day
    // anywhere west of Greenwich — Anchorage included.
    timeZone: "UTC",
  });
}

/** Departure time in the viewer's locale. This one IS a real instant,
 *  so it is parsed normally. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
