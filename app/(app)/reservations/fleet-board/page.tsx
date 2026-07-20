import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { listAircraft } from "@/lib/api/ops";
import {
  BOOKING_STATUS_LABELS,
  type Booking,
  listBookings,
} from "@/lib/api/reservations";
import type { AircraftListItem } from "@/lib/api/types";

import { FleetBoardChrome } from "./fleet-board-chrome";

/**
 * /reservations/fleet-board — Fleet board.
 *
 * Legacy peregrineflight.com/reservations/fleet-board shape:
 *   * View toggle: List / Board / Split (default Board)
 *   * Per-day navigator: ← Today — <weekday>, <mon> <d> →
 *   * Metrics top-right: N flights (blue) · N/M seats (green)
 *   * Search + filter chips (Bases / Types / Pilots) + Go
 *   * Board view = aircraft-rows × time-columns (24h)
 *   * Empty state: "No aircraft. Adjust filters."
 */

type BoardView = "list" | "board" | "split";

function _parseView(raw: string | undefined): BoardView {
  return raw === "list" || raw === "split" ? raw : "board";
}

function _parseDate(raw: string | undefined): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!raw) return today;
  const parsed = new Date(`${raw}T00:00:00`);
  return Number.isFinite(parsed.getTime()) ? parsed : today;
}

function _isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function FleetBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; d?: string }>;
}) {
  const params = await searchParams;
  const view = _parseView(params.view);
  const day = _parseDate(params.d);
  const dayEnd = new Date(day);
  dayEnd.setDate(dayEnd.getDate() + 1);

  let bookings: Booking[] = [];
  let aircraft: AircraftListItem[] = [];
  let loadError: string | null = null;
  try {
    const [bookingsResp, aircraftResp] = await Promise.all([
      listBookings({
        from_date: day.toISOString(),
        to_date: dayEnd.toISOString(),
        limit: 500,
      }),
      listAircraft(),
    ]);
    bookings = bookingsResp.items;
    aircraft = aircraftResp.items.filter((a) => a.is_active);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Fleet board unavailable. Try refreshing in a moment.";
  }

  // Metrics — flights that day + seat capacity used.
  const openBookings = bookings.filter((b) => b.status !== "cancelled");
  const flightsCount = openBookings.length;
  const bookedSeats = openBookings.reduce((sum, b) => sum + b.pax_count, 0);
  const totalSeatsUsed = openBookings.reduce((sum, b) => {
    if (!b.aircraft) return sum;
    const ac = aircraft.find((a) => a.id === b.aircraft?.id);
    return sum + (ac?.seats ?? 0);
  }, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <FleetBoardChrome
        view={view}
        day={day}
        isoDay={_isoDate(day)}
        flightsCount={flightsCount}
        bookedSeats={bookedSeats}
        totalSeats={totalSeatsUsed}
      />

      {loadError ? (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : aircraft.length === 0 ? (
        <div className="mt-8 text-center text-sm text-muted-foreground">
          No aircraft. Adjust filters.
        </div>
      ) : view === "list" ? (
        <ListView bookings={bookings} />
      ) : view === "split" ? (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ListView bookings={bookings} />
          <BoardView aircraft={aircraft} bookings={bookings} day={day} />
        </div>
      ) : (
        <BoardView aircraft={aircraft} bookings={bookings} day={day} />
      )}
    </div>
  );
}

// ============================================================================
// List view
// ============================================================================

function ListView({ bookings }: { bookings: Booking[] }) {
  const sorted = [...bookings].sort(
    (a, b) =>
      new Date(a.requested_departure_at).getTime() -
      new Date(b.requested_departure_at).getTime(),
  );
  if (sorted.length === 0) {
    return (
      <div className="mt-8 rounded-lg border border-border bg-card px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          No bookings on this date.
        </p>
        <p className="mt-2 text-xs text-muted-foreground/70">
          <Link
            href="/reservations/bookings/new"
            className="text-status-blue hover:underline"
          >
            File a new booking
          </Link>{" "}
          or pick a different day.
        </p>
      </div>
    );
  }
  return (
    <ul className="mt-4 space-y-2">
      {sorted.map((b) => (
        <li key={b.id}>
          <Link
            href={`/reservations/bookings/${b.id}`}
            className="flex flex-wrap items-baseline justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm hover:bg-muted/5"
          >
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-baseline gap-2">
                <span className="font-semibold tabular-nums">
                  {_timeOnly(b.requested_departure_at)}
                </span>
                <span className="text-muted-foreground">
                  {b.origin_icao} → {b.destination_icao}
                </span>
                {b.aircraft ? (
                  <span className="rounded border border-border bg-muted/20 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    {b.aircraft.tail_number}
                  </span>
                ) : null}
              </div>
              <p className="line-clamp-1 text-xs text-muted-foreground">
                {b.customer.full_name}
                {b.customer.company_name
                  ? ` · ${b.customer.company_name}`
                  : ""}{" "}
                · {b.pax_count} pax
              </p>
            </div>
            <StatusChip status={b.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ============================================================================
// Board view — aircraft rows × 24h columns
// ============================================================================

function BoardView({
  aircraft,
  bookings,
  day,
}: {
  aircraft: AircraftListItem[];
  bookings: Booking[];
  day: Date;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <div className="min-w-[64rem]">
          {/* Hour header row */}
          <div className="grid grid-cols-[8rem_repeat(24,minmax(0,1fr))] border-b border-border bg-muted/10 text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
            <div className="border-r border-border px-3 py-2 font-semibold">
              Aircraft
            </div>
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="border-r border-border/50 px-1 py-2 text-center tabular-nums"
              >
                {h % 2 === 0 ? String(h).padStart(2, "0") : ""}
              </div>
            ))}
          </div>

          {aircraft.map((a) => (
            <AircraftRow
              key={a.id}
              aircraft={a}
              bookings={bookings.filter((b) => b.aircraft?.id === a.id)}
              day={day}
            />
          ))}

          <UnassignedRow
            bookings={bookings.filter((b) => !b.aircraft)}
            day={day}
          />
        </div>
      </div>
    </div>
  );
}

function AircraftRow({
  aircraft,
  bookings,
  day,
}: {
  aircraft: AircraftListItem;
  bookings: Booking[];
  day: Date;
}) {
  return (
    <div className="grid grid-cols-[8rem_1fr] items-stretch border-b border-border/50 last:border-b-0">
      <div className="border-r border-border px-3 py-2 text-xs">
        <div className="font-semibold">{aircraft.tail_number}</div>
        {aircraft.model ? (
          <div className="text-[0.65rem] text-muted-foreground">
            {aircraft.model}
          </div>
        ) : null}
        <div className="text-[0.65rem] text-muted-foreground">
          {aircraft.seats} seats
        </div>
      </div>
      <TimelineTrack bookings={bookings} day={day} />
    </div>
  );
}

function UnassignedRow({
  bookings,
  day,
}: {
  bookings: Booking[];
  day: Date;
}) {
  if (bookings.length === 0) return null;
  return (
    <div className="grid grid-cols-[8rem_1fr] items-stretch border-t-2 border-status-yellow/40">
      <div className="border-r border-border px-3 py-2 text-xs">
        <div className="font-semibold text-status-yellow">Unassigned</div>
        <div className="text-[0.65rem] text-muted-foreground">
          Needs aircraft
        </div>
      </div>
      <TimelineTrack bookings={bookings} day={day} />
    </div>
  );
}

function TimelineTrack({
  bookings,
  day,
}: {
  bookings: Booking[];
  day: Date;
}) {
  return (
    <div className="relative h-14">
      {/* Faint hourly gridlines (23 = between hours) */}
      {Array.from({ length: 23 }, (_, i) => (
        <div
          key={i}
          className="absolute top-0 h-full border-r border-border/25"
          style={{ left: `${((i + 1) / 24) * 100}%` }}
        />
      ))}
      {bookings.map((b) => (
        <BookingBlock key={b.id} b={b} day={day} />
      ))}
    </div>
  );
}

function BookingBlock({ b, day }: { b: Booking; day: Date }) {
  const dep = new Date(b.requested_departure_at);
  const arr = b.estimated_arrival_at ? new Date(b.estimated_arrival_at) : null;
  const dayStart = day.getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  const startMs = Math.max(dep.getTime(), dayStart);
  const endMs = arr
    ? Math.min(arr.getTime(), dayEnd)
    : Math.min(dep.getTime() + 2 * 60 * 60 * 1000, dayEnd);
  const leftPct = ((startMs - dayStart) / (24 * 60 * 60 * 1000)) * 100;
  const widthPct = Math.max(
    2,
    ((endMs - startMs) / (24 * 60 * 60 * 1000)) * 100,
  );

  const bg =
    b.status === "confirmed"
      ? "border-status-green/60 bg-status-green/25 text-status-green"
      : b.status === "quoted"
        ? "border-status-yellow/60 bg-status-yellow/25 text-status-yellow"
        : b.status === "cancelled"
          ? "border-status-red/40 bg-status-red/15 text-status-red line-through opacity-60"
          : b.status === "completed"
            ? "border-border bg-muted/40 text-muted-foreground"
            : "border-status-blue/60 bg-status-blue/25 text-status-blue";

  return (
    <Link
      href={`/reservations/bookings/${b.id}`}
      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
      className={
        "absolute top-1 bottom-1 flex items-center gap-1 overflow-hidden rounded border px-1.5 text-[0.65rem] font-semibold whitespace-nowrap hover:z-10 hover:brightness-125 " +
        bg
      }
      title={`${b.origin_icao} → ${b.destination_icao} · ${b.customer.full_name} · ${b.pax_count} pax · ${BOOKING_STATUS_LABELS[b.status]}`}
    >
      <span className="tabular-nums">
        {_timeOnly(b.requested_departure_at)}
      </span>
      <span className="truncate">
        {b.origin_icao}→{b.destination_icao}
      </span>
    </Link>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function _timeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusChip({ status }: { status: Booking["status"] }) {
  const cls =
    status === "requested"
      ? "border-status-blue bg-status-blue/15 text-status-blue"
      : status === "quoted"
        ? "border-status-yellow bg-status-yellow/15 text-status-yellow"
        : status === "confirmed"
          ? "border-status-green bg-status-green/15 text-status-green"
          : status === "cancelled"
            ? "border-status-red/40 bg-status-red/10 text-status-red"
            : "border-border bg-muted/20 text-muted-foreground";
  return (
    <span
      className={
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
        cls
      }
    >
      {BOOKING_STATUS_LABELS[status]}
    </span>
  );
}
