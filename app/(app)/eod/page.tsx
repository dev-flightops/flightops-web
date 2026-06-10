import Link from "next/link";

import { StatusBadge } from "@/components/flight-following/status-badge";
import { ApiError } from "@/lib/api/client";
import { listFlights } from "@/lib/api/ops";
import type { FlightListItem } from "@/lib/api/types";
import { formatBoth, formatZulu } from "@/lib/format/flight-time";

import { CancelStaleButton } from "./cancel-stale-button";

/**
 * /eod — End-of-Day Closeout (M2-G-25).
 *
 * Layout mirrors the legacy `templates/flight_following/eod.html`:
 *   - Header with today's date + back-to-board link
 *   - 4 stat tiles: Completed / Block Hours / Still Airborne / Stale
 *   - 4 sections: Completed | Airborne | Stale Planned | Today's Planned
 *   - "Cancel N stale flight(s)" bulk action on the Stale section
 *
 * Data flow: three parallel listFlights() calls instead of a dedicated
 * EOD aggregation endpoint. Cheap enough for the demo tenant (10s of
 * flights) and lets us avoid a new backend route for the first cut.
 * If profiling shows pressure once tenants scale, a M3 backend
 * /eod/summary endpoint can fold these into one round-trip.
 *
 * "Block hours" uses scheduled times as a proxy — the Aircraft model
 * doesn't yet track actual_departure_at / actual_arrival_at (M2-G-11b
 * deferred Check-In flow). The tile is annotated "(scheduled)" so
 * the dispatcher knows it's a forecast, not a flown actual.
 *
 * Stale = status=scheduled AND scheduled_departure_at < now AND no
 * actuals. Today's Planned = status=scheduled AND scheduled_departure_at
 * is in the future, today UTC.
 *
 * Unclosed duty + unreconciled fuel sections from the legacy aren't
 * here yet — they need crew-service + ground-service which are M3.
 */

function todayUtcYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function todayUtcLong(): string {
  const now = new Date();
  return now.toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Cutoff for "stale" — any scheduled flight whose scheduled_departure_at
 *  is more than this many minutes in the past with no actuals counts as
 *  stale and surfaces in the EOD flags panel. */
const STALE_THRESHOLD_MIN = 15;

export default async function EodPage() {
  const today = todayUtcYmd();
  const nowMs = Date.now();
  const staleCutoff = nowMs - STALE_THRESHOLD_MIN * 60 * 1000;

  let completedToday: FlightListItem[] = [];
  let airborne: FlightListItem[] = [];
  let allScheduled: FlightListItem[] = [];
  let loadError: string | null = null;

  try {
    const [completed, released, scheduled] = await Promise.all([
      listFlights({ status: "completed", onDate: today, limit: 200 }),
      listFlights({ status: "released", limit: 200 }),
      listFlights({ status: "scheduled", limit: 200 }),
    ]);
    completedToday = completed.items;
    airborne = released.items;
    allScheduled = scheduled.items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "EOD feed unavailable. Try refreshing in a moment.";
  }

  // Split scheduled flights into "stale" (departure window past, never
  // departed) and "today's planned" (departure still ahead, today UTC).
  const stale: FlightListItem[] = [];
  const todayPlanned: FlightListItem[] = [];
  for (const f of allScheduled) {
    const dep = Date.parse(f.scheduled_departure_at);
    if (dep < staleCutoff) {
      stale.push(f);
    } else if (f.scheduled_departure_at.slice(0, 10) === today) {
      todayPlanned.push(f);
    }
  }

  const totalBlockHours = computeBlockHours(completedToday);
  const flagsCount = stale.length;  // duty + fuel sections await M3

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
            End-of-Day Closeout
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {todayUtcLong()} UTC
          </p>
        </div>
        <Link
          href="/flight-following"
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40"
        >
          ← Back to Board
        </Link>
      </header>

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : (
        <>
          <StatTiles
            completed={completedToday.length}
            blockHours={totalBlockHours}
            airborne={airborne.length}
            flags={flagsCount}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CompletedSection flights={completedToday} />
            <AirborneSection flights={airborne} />
            <FlagsSection stale={stale} />
            {todayPlanned.length > 0 && (
              <PlannedSection flights={todayPlanned} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function computeBlockHours(flights: FlightListItem[]): string {
  // Without actuals (M2-G-11b deferred) we sum scheduled durations.
  let totalMs = 0;
  for (const f of flights) {
    const dep = Date.parse(f.scheduled_departure_at);
    const arr = Date.parse(f.scheduled_arrival_at);
    if (Number.isFinite(dep) && Number.isFinite(arr) && arr > dep) {
      totalMs += arr - dep;
    }
  }
  const hours = totalMs / (1000 * 60 * 60);
  return hours.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function StatTiles({
  completed,
  blockHours,
  airborne,
  flags,
}: {
  completed: number;
  blockHours: string;
  airborne: number;
  flags: number;
}) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
      <Tile value={String(completed)} label="Flights Completed" tone="green" />
      <Tile value={blockHours} label="Block Hours (scheduled)" tone="blue" />
      <Tile
        value={String(airborne)}
        label="Still Airborne"
        tone={airborne > 0 ? "yellow" : "muted"}
      />
      <Tile
        value={String(flags)}
        label="Flags"
        tone={flags > 0 ? "red" : "muted"}
      />
    </div>
  );
}

function Tile({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "green" | "blue" | "yellow" | "red" | "muted";
}) {
  const toneClass = {
    green: "text-status-green",
    blue: "text-status-blue",
    yellow: "text-status-yellow",
    red: "text-status-red",
    muted: "text-muted-foreground",
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-card py-3 text-center">
      <div className={`text-2xl font-bold tabular-nums ${toneClass}`}>
        {value}
      </div>
      <div className="text-[0.65rem] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function CompletedSection({ flights }: { flights: FlightListItem[] }) {
  return (
    <Section title="Completed Flights" tone="green">
      {flights.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No flights completed today.
        </p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-left text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            <tr>
              <th className="px-2 py-1">Flight</th>
              <th className="px-2 py-1">Aircraft</th>
              <th className="px-2 py-1">Route</th>
              <th className="px-2 py-1">Block</th>
            </tr>
          </thead>
          <tbody>
            {flights.map((f) => (
              <tr key={f.id} className="border-t border-border">
                <td className="px-2 py-1.5 font-semibold">
                  {f.flight_number || "—"}
                </td>
                <td className="px-2 py-1.5 font-mono">
                  {f.aircraft.tail_number}
                </td>
                <td className="px-2 py-1.5 font-mono">
                  {f.origin} → {f.destination}
                </td>
                <td className="px-2 py-1.5 text-muted-foreground">
                  {flightBlockHours(f)}h
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

function AirborneSection({ flights }: { flights: FlightListItem[] }) {
  return (
    <Section title="Still Airborne" tone="yellow">
      {flights.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No aircraft currently airborne.
        </p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-left text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            <tr>
              <th className="px-2 py-1">Flight</th>
              <th className="px-2 py-1">Aircraft</th>
              <th className="px-2 py-1">Route</th>
              <th className="px-2 py-1">ETA</th>
            </tr>
          </thead>
          <tbody>
            {flights.map((f) => (
              <tr
                key={f.id}
                className="border-t border-border bg-status-yellow/[0.04]"
              >
                <td className="px-2 py-1.5 font-semibold">
                  {f.flight_number || "—"}
                </td>
                <td className="px-2 py-1.5 font-mono">
                  {f.aircraft.tail_number}
                </td>
                <td className="px-2 py-1.5 font-mono">
                  {f.origin} → {f.destination}
                </td>
                <td className="px-2 py-1.5 font-mono text-muted-foreground">
                  {formatZulu(f.scheduled_arrival_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

function FlagsSection({ stale }: { stale: FlightListItem[] }) {
  if (stale.length === 0) {
    return (
      <Section title="Flags Requiring Attention" tone="red" wide>
        <p className="text-xs text-status-green">
          No flags. All clear for end of day.
        </p>
      </Section>
    );
  }
  return (
    <Section title="Flags Requiring Attention" tone="red" wide>
      <div>
        <div className="mb-2 text-xs font-semibold text-status-red">
          Stale Planned Flights ({stale.length})
        </div>
        <ul className="space-y-1">
          {stale.map((f) => (
            <li
              key={f.id}
              className="rounded border border-status-red/15 bg-status-red/5 px-2 py-1.5 text-xs"
            >
              <span className="font-semibold">{f.flight_number || "—"}</span>
              <span className="ml-2 font-mono">{f.aircraft.tail_number}</span>
              <span className="ml-2 font-mono">
                {f.origin} → {f.destination}
              </span>
              <span className="ml-2 text-muted-foreground">
                — ETD {formatZulu(f.scheduled_departure_at)}, never departed
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <CancelStaleButton flightIds={stale.map((f) => f.id)} />
        </div>
      </div>
    </Section>
  );
}

function PlannedSection({ flights }: { flights: FlightListItem[] }) {
  return (
    <Section title="Planned — Not Yet Departed" tone="muted" wide>
      <table className="w-full text-xs">
        <thead className="text-left text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <tr>
            <th className="px-2 py-1">Flight</th>
            <th className="px-2 py-1">Aircraft</th>
            <th className="px-2 py-1">Route</th>
            <th className="px-2 py-1">ETD</th>
            <th className="px-2 py-1">Status</th>
          </tr>
        </thead>
        <tbody>
          {flights.map((f) => (
            <tr key={f.id} className="border-t border-border">
              <td className="px-2 py-1.5 font-semibold">
                {f.flight_number || "—"}
              </td>
              <td className="px-2 py-1.5 font-mono">
                {f.aircraft.tail_number}
              </td>
              <td className="px-2 py-1.5 font-mono">
                {f.origin} → {f.destination}
              </td>
              <td className="px-2 py-1.5 font-mono text-muted-foreground">
                {formatBoth(f.scheduled_departure_at).zulu}
              </td>
              <td className="px-2 py-1.5">
                <StatusBadge status={f.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

function Section({
  title,
  tone,
  wide,
  children,
}: {
  title: string;
  tone: "green" | "yellow" | "red" | "muted";
  wide?: boolean;
  children: React.ReactNode;
}) {
  const toneClass = {
    green: "text-status-green",
    yellow: "text-status-yellow",
    red: "text-status-red",
    muted: "text-foreground",
  }[tone];
  return (
    <section
      className={`rounded-lg border border-border bg-card p-4 ${wide ? "lg:col-span-2" : ""}`}
    >
      <h2
        className={`mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.08em] ${toneClass}`}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function flightBlockHours(f: FlightListItem): string {
  const dep = Date.parse(f.scheduled_departure_at);
  const arr = Date.parse(f.scheduled_arrival_at);
  if (!Number.isFinite(dep) || !Number.isFinite(arr) || arr <= dep) return "—";
  const hours = (arr - dep) / (1000 * 60 * 60);
  return hours.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
