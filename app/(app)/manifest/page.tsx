import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { listFlights } from "@/lib/api/ops";
import type { FlightListItem, FlightStatus } from "@/lib/api/types";

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
 * We already have flights CRUD on the ops-service; the missing
 * legacy bits (flight_type, PIC, per-flight legs / route chains)
 * aren't on FlightListItem yet — they show as em-dash until the
 * fuller schedule surface lands with Marc's manifest module.
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

function toDayKey(iso: string): string {
  // Slice YYYY-MM-DD off the ISO string — server passes UTC.
  return iso.slice(0, 10);
}

function todayUtcKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
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

function formatToday(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatDepTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
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

  const today = todayUtcKey();

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
    const key = toDayKey(f.scheduled_departure_at);
    if (range === "today") return key === today;
    if (range === "past") return key < today;
    if (range === "upcoming") return key >= today;
    return true;
  });

  // Stats
  const todayFlights = flights.filter(
    (f) => toDayKey(f.scheduled_departure_at) === today,
  );
  const activeNow = flights.filter(
    (f) => f.status === "released" && !f.actual_arrival_at,
  ).length;

  // Group filtered flights by day key.
  const byDate = new Map<string, FlightListItem[]>();
  for (const f of filtered) {
    const key = toDayKey(f.scheduled_departure_at);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(f);
  }
  const orderedKeys = Array.from(byDate.keys()).sort();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Flight Schedule</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Scheduling, manifest, and multi-stop routing
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Flight schedule templates ship with Marc's manifest module"
            className="cursor-not-allowed rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground/80 disabled:opacity-100"
          >
            Templates
          </button>
          <Link
            href="/dispatch/new"
            className="rounded-md bg-status-blue px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            + New Flight
          </Link>
        </div>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        <StatCard value={formatToday()} label="Today" small />
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
                      ? "bg-status-blue text-white"
                      : "bg-muted/20 text-muted-foreground hover:text-foreground")
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
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
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
              className="rounded-md bg-status-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
            >
              Filter
            </button>
          </div>
        </form>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      ) : orderedKeys.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center">
          <p className="mb-4 text-sm text-muted-foreground">
            No flights found.
          </p>
          <Link
            href="/dispatch/new"
            className="inline-block rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
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
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div
        className={
          (small ? "text-sm font-semibold" : "text-2xl font-bold ") +
          " " +
          (valueClass || "text-foreground")
        }
      >
        {value}
      </div>
      <div className="mt-0.5 text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function DayBlock({
  dayKey,
  flights,
  isToday,
}: {
  dayKey: string;
  flights: FlightListItem[];
  isToday: boolean;
}) {
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center gap-3 px-1">
        <h2
          className={
            "text-xs font-semibold uppercase tracking-wider " +
            (isToday ? "text-status-blue" : "text-muted-foreground")
          }
        >
          {isToday ? "TODAY — " : ""}
          {formatDayHeading(dayKey)}
        </h2>
        <span className="text-xs text-muted-foreground/60">
          {flights.length} flight{flights.length === 1 ? "" : "s"}
        </span>
        {isToday && (
          <div className="h-px flex-1 bg-status-blue/20" aria-hidden />
        )}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
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
                    "hover:bg-muted/5 " +
                    (f.status === "cancelled" ? "opacity-40" : "")
                  }
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold">
                    <Link
                      href={`/dispatch/${f.id}`}
                      className="text-status-blue hover:underline"
                    >
                      {f.flight_number}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                    {f.origin} → {f.destination}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                    {f.aircraft.tail_number}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                    {formatDepTime(f.scheduled_departure_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <FlightStatusBadge status={f.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Link
                      href={`/dispatch/${f.id}`}
                      className="text-xs font-semibold text-status-blue hover:underline"
                    >
                      Open →
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
    scheduled: ["border-border bg-muted/20 text-muted-foreground", "Scheduled"],
    released: [
      "border-status-blue/40 bg-status-blue/10 text-status-blue",
      "Released",
    ],
    completed: [
      "border-status-green/40 bg-status-green/10 text-status-green",
      "Completed",
    ],
    cancelled: [
      "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
      "Cancelled",
    ],
  };
  const [cls, label] = map[status];
  return (
    <span
      className={
        "rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
        cls
      }
    >
      {label}
    </span>
  );
}
