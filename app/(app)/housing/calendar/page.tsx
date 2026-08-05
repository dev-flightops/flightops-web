import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import {
  BOOKING_PURPOSE_LABELS,
  getHousingUnit,
  listHousingBookings,
  listHousingUnits,
  type BookingPurpose,
  type HousingBooking,
  type HousingRoom,
  type HousingUnit,
} from "@/lib/api/housing";

/**
 * /housing/calendar — 7-day booking calendar.
 *
 * Rows = rooms grouped by unit; columns = 7 days starting `from`
 * (default: this week's Monday). Each cell renders a booking block
 * if a booking covers that room+date, colored by the unit's
 * `color_accent` (or the platform default) and labeled with the
 * employee's initials + purpose.
 *
 * Data flow:
 *   - `listHousingUnits()` for the unit grouping + accent colors
 *   - `listHousingBookings({ from, to })` for the 7-day window
 *   - `getHousingUnit(id)` per active unit to pull rooms (the list
 *     endpoint doesn't include rooms; keep the fetches parallel)
 *
 * Interactions today are read-only: click a booking → jump to
 * `/housing/[unitId]` where the full booking row + cancel action
 * live. Drag-to-book from the legacy tag row is deferred to a
 * follow-up story (needs a booking-create modal + drag state).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const dynamic = "force-dynamic";

export default async function HousingCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const params = await searchParams;
  const anchor = parseDateOr(params.from, mondayOfThisWeek());
  const days = Array.from({ length: 7 }, (_, i) => addDays(anchor, i));
  const fromIso = isoDay(days[0]);
  const toIso = isoDay(days[days.length - 1]);

  let units: HousingUnit[] = [];
  let bookings: HousingBooking[] = [];
  let unitsRooms: Map<string, HousingRoom[]> = new Map();
  let loadError: string | null = null;
  try {
    const unitsResp = await listHousingUnits();
    units = unitsResp.items.filter((u) => u.is_active);
    // Rooms come from the detail endpoint — one fetch per unit,
    // in parallel. Bookings pull covers the whole window.
    const [bookingsResp, ...detailResps] = await Promise.all([
      listHousingBookings({ from: fromIso, to: toIso }),
      ...units.map((u) => getHousingUnit(u.id)),
    ]);
    bookings = bookingsResp.items;
    unitsRooms = new Map(
      detailResps.map((r) => [r.unit.id, r.rooms]),
    );
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Housing calendar unavailable. Try refreshing in a moment.";
  }

  const prevAnchor = addDays(anchor, -7);
  const nextAnchor = addDays(anchor, 7);
  const today = mondayOfThisWeek();

  return (
    <div className="w-full px-4 py-6 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center text-xs">
        <Link
          href="/home"
          aria-label="Home"
          className="inline-flex items-center text-muted-foreground hover:text-foreground"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-3.5 w-3.5"
            aria-hidden
          >
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </svg>
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">
          ›
        </span>
        <Link
          href="/housing"
          className="text-muted-foreground hover:text-foreground"
        >
          Housing
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">
          ›
        </span>
        <span className="font-semibold text-status-blue">Calendar</span>
      </nav>

      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Housing Calendar
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Week of {fmtDay(anchor, "long")} · rooms × days
          </p>
        </div>
        <CalendarNav
          prevAnchor={prevAnchor}
          nextAnchor={nextAnchor}
          today={today}
          currentAnchor={anchor}
        />
      </header>

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      ) : units.length === 0 ? (
        <EmptyState />
      ) : (
        <CalendarGrid
          units={units}
          unitsRooms={unitsRooms}
          bookings={bookings}
          days={days}
        />
      )}

      <PurposeLegend />
    </div>
  );
}

function CalendarNav({
  prevAnchor,
  nextAnchor,
  today,
  currentAnchor,
}: {
  prevAnchor: Date;
  nextAnchor: Date;
  today: Date;
  currentAnchor: Date;
}) {
  const isToday = isoDay(today) === isoDay(currentAnchor);
  return (
    <nav
      aria-label="Calendar navigation"
      className="flex flex-wrap items-center gap-2"
    >
      <Link
        href={`/housing/calendar?from=${isoDay(prevAnchor)}`}
        className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-muted/20"
      >
        ← Prev week
      </Link>
      <Link
        href="/housing/calendar"
        className={
          "rounded-md px-3 py-1.5 text-xs font-semibold " +
          (isToday
            ? "bg-status-blue text-white"
            : "border border-border bg-card text-foreground/80 hover:bg-muted/20")
        }
      >
        Today
      </Link>
      <Link
        href={`/housing/calendar?from=${isoDay(nextAnchor)}`}
        className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-muted/20"
      >
        Next week →
      </Link>
    </nav>
  );
}

function CalendarGrid({
  units,
  unitsRooms,
  bookings,
  days,
}: {
  units: HousingUnit[];
  unitsRooms: Map<string, HousingRoom[]>;
  bookings: HousingBooking[];
  days: Date[];
}) {
  const activeBookings = bookings.filter((b) => !b.is_cancelled);
  const bookingsByRoom = new Map<string, HousingBooking[]>();
  for (const b of activeBookings) {
    const list = bookingsByRoom.get(b.room_id) ?? [];
    list.push(b);
    bookingsByRoom.set(b.room_id, list);
  }
  const todayIso = isoDay(new Date());

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[900px] table-fixed text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/10 text-left text-[0.65rem] uppercase tracking-[0.06em] text-muted-foreground">
            <th className="w-56 px-3 py-2.5 font-semibold">Unit / Room</th>
            {days.map((d) => (
              <th
                key={d.toISOString()}
                className={
                  "px-2 py-2.5 text-center font-semibold " +
                  (isoDay(d) === todayIso ? "bg-status-blue/10 text-status-blue" : "")
                }
              >
                <div>{fmtDay(d, "short")}</div>
                <div className="mt-0.5 font-mono text-[0.6rem] text-muted-foreground">
                  {d.getUTCDate()}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {units.map((u) => {
            const rooms = (unitsRooms.get(u.id) ?? [])
              .slice()
              .sort((a, b) =>
                a.room_number.localeCompare(b.room_number, undefined, {
                  numeric: true,
                }),
              );
            return (
              <UnitBlock
                key={u.id}
                unit={u}
                rooms={rooms}
                days={days}
                bookingsByRoom={bookingsByRoom}
                todayIso={todayIso}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function UnitBlock({
  unit,
  rooms,
  days,
  bookingsByRoom,
  todayIso,
}: {
  unit: HousingUnit;
  rooms: HousingRoom[];
  days: Date[];
  bookingsByRoom: Map<string, HousingBooking[]>;
  todayIso: string;
}) {
  if (rooms.length === 0) {
    return (
      <tr>
        <td className="px-3 py-3 align-top">
          <UnitLabel unit={unit} />
        </td>
        <td
          colSpan={days.length}
          className="px-3 py-3 text-center text-[0.7rem] italic text-muted-foreground"
        >
          No rooms yet — add rooms on the unit detail.
        </td>
      </tr>
    );
  }
  return (
    <>
      {rooms.map((r, i) => (
        <tr key={r.id} className="hover:bg-muted/5">
          <td className="border-l-4 px-3 py-2 align-top"
            style={{
              borderLeftColor:
                unit.color_accent && /^#[0-9a-fA-F]{6}$/.test(unit.color_accent)
                  ? unit.color_accent
                  : "transparent",
            }}
          >
            {i === 0 ? (
              <div className="mb-1">
                <UnitLabel unit={unit} />
              </div>
            ) : null}
            <Link
              href={`/housing/${unit.id}`}
              className="block font-mono text-xs text-foreground hover:text-status-blue"
            >
              {r.room_number}
              <span className="ml-1 text-[0.65rem] text-muted-foreground">
                · cap {r.capacity}
              </span>
            </Link>
          </td>
          {days.map((d) => {
            const dayIso = isoDay(d);
            const dayBookings = (bookingsByRoom.get(r.id) ?? []).filter(
              (b) => b.check_in <= dayIso && (b.check_out === null || b.check_out >= dayIso),
            );
            return (
              <td
                key={dayIso}
                className={
                  "px-1 py-1 align-top " +
                  (dayIso === todayIso ? "bg-status-blue/[0.06]" : "")
                }
              >
                <div className="flex flex-col gap-1">
                  {dayBookings.map((b) => (
                    <BookingBlock
                      key={b.id}
                      booking={b}
                      unit={unit}
                    />
                  ))}
                </div>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function UnitLabel({ unit }: { unit: HousingUnit }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
        {unit.name}
      </span>
      <span className="font-mono text-[0.6rem] text-muted-foreground/70">
        {unit.station}
      </span>
    </div>
  );
}

function BookingBlock({
  booking,
  unit,
}: {
  booking: HousingBooking;
  unit: HousingUnit;
}) {
  const initials = deriveInitials(booking.employee_name ?? "?");
  const purpose = (booking.purpose ?? "other") as BookingPurpose;
  const label = booking.employee_name ?? "Assigned";
  const purposeLabel = BOOKING_PURPOSE_LABELS[purpose] ?? "Other";
  const bg =
    unit.color_accent && /^#[0-9a-fA-F]{6}$/.test(unit.color_accent)
      ? unit.color_accent
      : "#3b82f6";
  return (
    <Link
      href={`/housing/${unit.id}`}
      title={`${label} · ${purposeLabel} · ${booking.check_in} → ${booking.check_out ?? "open"}`}
      className="block truncate rounded px-1.5 py-0.5 text-[0.65rem] font-semibold text-white hover:brightness-110"
      style={{ backgroundColor: bg }}
    >
      {initials}
      <span className="ml-1 font-normal opacity-90">· {purposeLabel}</span>
    </Link>
  );
}

function PurposeLegend() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 text-[0.7rem] text-muted-foreground">
      <span className="font-semibold uppercase tracking-[0.06em]">Purposes:</span>
      {(Object.keys(BOOKING_PURPOSE_LABELS) as BookingPurpose[]).map((p) => (
        <span
          key={p}
          className="rounded border border-border bg-card px-2 py-0.5"
        >
          {BOOKING_PURPOSE_LABELS[p]}
        </span>
      ))}
      <span className="ml-auto text-[0.65rem] text-muted-foreground/70">
        Block color = unit accent. Click any block to open the unit detail.
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-16 text-center">
      <p className="mb-2 text-sm text-foreground">
        No active housing units.
      </p>
      <p className="mx-auto max-w-md text-xs text-muted-foreground">
        Create a unit and add rooms first — the calendar populates from
        active bookings for those rooms.
      </p>
      <Link
        href="/housing"
        className="mt-4 inline-block rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-muted/20"
      >
        Go to Housing
      </Link>
    </div>
  );
}

// ---- date helpers ---------------------------------------------------------

function isoDay(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function parseDateOr(raw: string | undefined, fallback: Date): Date {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return fallback;
  const [y, m, d] = raw.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function mondayOfThisWeek(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff),
  );
}

function addDays(base: Date, delta: number): Date {
  return new Date(base.getTime() + delta * DAY_MS);
}

function fmtDay(d: Date, form: "short" | "long"): string {
  if (form === "short") {
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      timeZone: "UTC",
    });
  }
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function deriveInitials(name: string): string {
  const parts = name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]?.toUpperCase() ?? "");
  return (parts[0] ?? "?") + (parts[parts.length - 1] ?? "");
}
