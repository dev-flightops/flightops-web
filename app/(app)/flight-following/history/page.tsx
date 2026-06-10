import Link from "next/link";

import { StatusBadge } from "@/components/flight-following/status-badge";
import { ApiError } from "@/lib/api/client";
import { listFlights } from "@/lib/api/ops";
import type { FlightListItem } from "@/lib/api/types";
import { formatBoth } from "@/lib/format/flight-time";

/**
 * /flight-following/history — terminal-status flight log (M2-G-14).
 *
 * Mirrors the legacy `templates/flight_following/history.html`: a
 * single table of flights whose status is `completed` or `cancelled`,
 * ordered by their scheduled departure. Powered by the multi-value
 * status filter added in M2-M-15 (`?status=completed&status=cancelled`
 * lands as a single SQL query rather than two parallel fetches).
 *
 * ATD / ATA columns render `—` for now — the actuals columns ship
 * with M2-G-11b's Check-In flow. We render the placeholder so the
 * column structure matches the legacy and lights up automatically
 * when actuals arrive.
 */
const HISTORY_LIMIT = 100;

export default async function FlightFollowingHistoryPage() {
  let flights: FlightListItem[] = [];
  let loadError: string | null = null;

  try {
    flights = (
      await listFlights({
        status: ["completed", "cancelled"],
        limit: HISTORY_LIMIT,
      })
    ).items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Flight history unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <Link
          href="/flight-following"
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          ← Flight Following
        </Link>
        <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
          Flight History
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Completed and cancelled flights. Most recent {HISTORY_LIMIT}.
        </p>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : flights.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No completed or cancelled flights yet.
          </p>
        </div>
      ) : (
        <FlightHistoryTable flights={flights} />
      )}
    </div>
  );
}

function FlightHistoryTable({ flights }: { flights: FlightListItem[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-xs">
        <thead className="bg-muted/30">
          <tr className="text-left text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <th className="px-3 py-2">Flight</th>
            <th className="px-3 py-2">Aircraft</th>
            <th className="px-3 py-2">Route</th>
            <th className="px-3 py-2">ETD</th>
            <th className="px-3 py-2">ATD</th>
            <th className="px-3 py-2">ETA</th>
            <th className="px-3 py-2">ATA</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {flights.map((f) => (
            <FlightHistoryRow key={f.id} flight={f} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlightHistoryRow({ flight }: { flight: FlightListItem }) {
  const etd = formatBoth(flight.scheduled_departure_at);
  const eta = formatBoth(flight.scheduled_arrival_at);

  return (
    <tr className="border-t border-border hover:bg-muted/20">
      <td className="px-3 py-2.5 font-semibold text-foreground">
        {flight.flight_number || "—"}
      </td>
      <td className="px-3 py-2.5">
        <div className="font-mono text-foreground">
          {flight.aircraft.tail_number}
        </div>
        <div className="text-[0.65rem] text-muted-foreground">
          {flight.aircraft.model}
        </div>
      </td>
      <td className="px-3 py-2.5 font-mono">
        {flight.origin}
        <span className="text-muted-foreground"> → </span>
        {flight.destination}
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">
        <div className="font-mono">{etd.local}</div>
        <div className="font-mono text-[0.65rem] opacity-80">{etd.zulu}</div>
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">—</td>
      <td className="px-3 py-2.5 text-muted-foreground">
        <div className="font-mono">{eta.local}</div>
        <div className="font-mono text-[0.65rem] opacity-80">{eta.zulu}</div>
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">—</td>
      <td className="px-3 py-2.5">
        <StatusBadge status={flight.status} />
      </td>
    </tr>
  );
}
