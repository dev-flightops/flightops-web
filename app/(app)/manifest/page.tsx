import Link from "next/link";

import { loadZoneTable } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { listFlights } from "@/lib/api/ops";
import { localClock, localDay, utcToLocalInput } from "@/lib/format/local-time";
import type { FlightListItem, FlightStatus } from "@/lib/api/types";
import { routeText } from "@/lib/route";

/**
 * /manifest — legacy `templates/manifest/schedule.html`. Flight
 * Schedule / multi-stop routing landing.
 *
 * NOT the "passenger manifests" list (which is legacy
 * `templates/manifest/list.html`) — that lives elsewhere in the
 * legacy IA. /manifest/ is the ops-facing schedule board:
 *   - Stats row: today's flights, active now, showing, today date
 *   - Filter tabs: Upcoming / Today / Past / All + type + status
 *   - Flights grouped by date with per-flight open link
 *
 * Route chains come from the same flight data as the master schedule,
 * so a round trip retains its intermediate stop here too.
 */

const RANGES = [
  { id: "upcoming", label: "Upcoming" },
  { id: "today", label: "Today" },
  { id: "past", label: "Past" },
  { id: "all", label: "All" },
] as const;

type RangeId = (typeof RANGES)[number]["id"];

const STATUSES: readonly { value: FlightStatus; label: string }[] = [
  { value: "scheduled", label: "Scheduled" },
  { value: "released", label: "Released" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export const dynamic = "force-dynamic";

function parseRange(v: string | string[] | undefined): RangeId {
  const s = Array.isArray(v) ? v[0] : v;
  if (s === "today" || s === "past" || s === "all") return s;
  return "upcoming";
}

function parseStatus(
  v: string | string[] | undefined,
): FlightStatus | null {
  const s = Array.isArray(v) ? v[0] : v;
  if (
    s === "scheduled" ||
    s === "released" ||
    s === "completed" ||
    s === "cancelled"
  ) {
    return s;
  }
  return null;
}

/** The company's day an instant falls on (#134): in UTC, an evening in
 *  Alaska was already tomorrow, and the times read as Alaska's. */
function toDayKey(iso: string, zone: string): string {
  return utcToLocalInput(iso, zone).slice(0, 10);
}

function formatDayHeading(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatToday(zone: string): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: zone,
  });
}

export default async function FlightSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string | string[];
    status?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const range = parseRange(params.range);
  const statusFilter = parseStatus(params.status);

  const zone = (await loadZoneTable().catch(() => null))?.fallback ?? "America/Anchorage";
  const today = localDay(zone);

  let flights: FlightListItem[] = [];
  let loadError: string | null = null;
  try {
    // Pull the biggest window /ops/flights accepts (le=200) —
    // schedule is normally a few weeks of near-term flights.
    // Client-side filters below narrow it.
    const response = await listFlights({
      status: statusFilter ?? undefined,
      limit: 200,
    });
    flights = response.items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Flight schedule unavailable. Try refreshing in a moment.";
  }

  // Range filter — done in-process because the backend
  // /ops/flights endpoint filters by exact date, not range.
  const filtered = flights.filter((f) => {
    const key = toDayKey(f.scheduled_departure_at, zone);
    if (range === "today") return key === today;
    if (range === "past") return key < today;
    if (range === "upcoming") return key >= today;
    return true;
  });

  // Stats
  const todayFlights = flights.filter(
    (f) => toDayKey(f.scheduled_departure_at, zone) === today,
  );
  const activeNow = flights.filter(
    (f) => f.status === "released" && !f.actual_arrival_at,
  ).length;

  // Group filtered flights by day key.
  const byDate = new Map<string, FlightListItem[]>();
  for (const f of filtered) {
    const key = toDayKey(f.scheduled_departure_at, zone);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(f);
  }
  const orderedKeys = Array.from(byDate.keys()).sort();

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <header className="mb-6 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Flight Schedule</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Scheduling, manifest, and multi-stop routing
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/flight-following/new"
            className="btn-caps rounded-md bg-primary px-3 py-2 text-white hover:bg-brand-dark"
          >
            + New Flight
          </Link>
        </div>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <StatCard
          value={String(todayFlights.length)}
          label="Today's Flights"
        />
        <StatCard
          value={String(activeNow)}
          label="Active Now"
          valueClass={activeNow > 0 ? "text-status-green" : ""}
        />
        <StatCard
          value={String(filtered.length)}
          label="Showing"
          valueClass="text-status-blue"
        />
        <StatCard value={formatToday(zone)} label="Today" small />
      </div>

      <div className="mb-5 rounded-lg border border-border bg-card px-4 py-3">
        <form className="flex flex-wrap items-center gap-2" method="GET">
          <div className="flex gap-1">
            {RANGES.map((r) => {
              const active = r.id === range;
              const href = `/manifest?range=${r.id}${statusFilter ? `&status=${statusFilter}` : ""}`;
              return (
                <Link
                  key={r.id}
                  href={href}
                  className={
                    "rounded-lg px-3 py-1.5 text-xs font-medium " +
                    (active
                      ? "bg-primary text-white"
                      : "bg-muted text-muted-foreground hover:text-foreground")
                  }
                >
                  {r.label}
                </Link>
              );
            })}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <input type="hidden" name="range" value={range} />
            <select
              name="status"
              defaultValue={statusFilter ?? ""}
              className="ff-input px-2 py-1.5 text-xs w-auto"
            >
              <option value="">All Status</option>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="btn-caps rounded-md bg-primary px-3 py-1.5 text-white hover:bg-brand-dark text-[0.72rem]"
            >
              Filter
            </button>
          </div>
        </form>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="notice notice-yellow"
        >
          {loadError}
        </div>
      ) : orderedKeys.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center">
          <p className="mb-4 text-sm text-muted-foreground">
            No flights found.
          </p>
          <Link
            href="/flight-following/new"
            className="btn-caps inline-block rounded-md bg-primary px-4 py-2 text-white hover:bg-brand-dark"
          >
            Schedule First Flight
          </Link>
        </div>
      ) : (
        orderedKeys.map((key) => (
          <DayBlock
            key={key}
            dayKey={key}
            flights={byDate.get(key)!}
            isToday={key === today}
            zone={zone}
          />
        ))
      )}
    </div>
  );
}

function StatCard({
  value,
  label,
  valueClass = "",
  small = false,
}: {
  value: string;
  label: string;
  valueClass?: string;
  small?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col border-l-2 border-input py-1 pl-3">
      <div
        className={
          (small ? "text-sm font-semibold" : "font-display text-[1.75rem] font-extrabold leading-none tabular-nums") +
          " " +
          (valueClass || "text-foreground")
        }
      >
        {value}
      </div>
      <div className="eyebrow mt-1.5">
        {label}
      </div>
    </div>
  );
}

function DayBlock({
  dayKey,
  flights,
  isToday,
  zone,
}: {
  dayKey: string;
  flights: FlightListItem[];
  isToday: boolean;
  zone: string;
}) {
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center gap-3 px-1">
        <h2
          className={
            "text-xs font-semibold uppercase tracking-wider " +
            (isToday ? "text-primary" : "text-muted-foreground")
          }
        >
          {isToday ? "TODAY — " : ""}
          {formatDayHeading(dayKey)}
        </h2>
        <span className="text-xs text-muted-foreground">
          {flights.length} flight{flights.length === 1 ? "" : "s"}
        </span>
        {isToday && (
          <div className="h-px flex-1 bg-primary/20" aria-hidden />
        )}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="ff-thead">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Flight</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Route</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Aircraft</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Dep</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                <th scope="col" className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {flights.map((f) => (
                <tr
                  key={f.id}
                  className={
                    "hover:bg-accent " +
                    (f.status === "cancelled" ? "opacity-40" : "")
                  }
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold">
                    <Link
                      href={`/manifest/${f.id}`}
                      className="text-primary hover:underline"
                    >
                      {f.flight_number}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                    {routeText(f)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                    {f.aircraft.tail_number}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                    {localClock(f.scheduled_departure_at, zone)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <FlightStatusBadge status={f.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {f.status === "cancelled" ? null : (
                      <Link
                        href={`/check-in/${f.id}`}
                        className="mr-4 text-xs font-semibold text-primary hover:underline"
                      >
                        Check-in →
                      </Link>
                    )}
                    <Link
                      href={`/manifest/${f.id}`}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Manifest →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function FlightStatusBadge({ status }: { status: FlightStatus }) {
  const map: Record<FlightStatus, [string, string]> = {
    scheduled: ["text-muted-foreground", "Scheduled"],
    released: [
      "text-status-blue",
      "Released",
    ],
    completed: [
      "text-status-green",
      "Completed",
    ],
    cancelled: [
      "text-status-yellow",
      "Cancelled",
    ],
  };
  const [cls, label] = map[status];
  return (
    <span
      className={
        "status-mark " +
        cls
      }
    >
      {label}
    </span>
  );
}
