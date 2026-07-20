import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import {
  BOOKING_STATUS_LABELS,
  type Booking,
  type BookingStatus,
  listBookings,
} from "@/lib/api/reservations";

/**
 * /reservations — Fleet board.
 *
 * Slice 1 shape: bookings grouped by departure date, sorted by
 * departure time within each day. The proper aircraft-rows-with-
 * time-columns grid lands in a follow-up story — for now this
 * list layout gives dispatchers the primary "what's booked when"
 * view without a bunch of layout math.
 *
 * Filters: date window (default = next 14 days), status.
 */

const STATUS_FILTERS: Array<{
  key: string;
  label: string;
  status?: BookingStatus;
}> = [
  { key: "open", label: "Open (default)" },
  { key: "requested", label: "Requested", status: "requested" },
  { key: "quoted", label: "Quoted", status: "quoted" },
  { key: "confirmed", label: "Confirmed", status: "confirmed" },
  { key: "all", label: "All" },
];

const DEFAULT_DAYS_AHEAD = 14;

export default async function FleetBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; days?: string }>;
}) {
  const params = await searchParams;
  const filterKey = params.status ?? "open";
  const activeFilter =
    STATUS_FILTERS.find((f) => f.key === filterKey) ?? STATUS_FILTERS[0];
  const daysAhead = Math.max(
    1,
    Math.min(90, Number(params.days) || DEFAULT_DAYS_AHEAD),
  );

  const now = new Date();
  const fromDate = new Date(now);
  fromDate.setHours(0, 0, 0, 0);
  const toDate = new Date(fromDate);
  toDate.setDate(toDate.getDate() + daysAhead);

  let bookings: Booking[] = [];
  let total = 0;
  let loadError: string | null = null;
  try {
    if (activeFilter.key === "open") {
      const response = await listBookings({
        from_date: fromDate.toISOString(),
        to_date: toDate.toISOString(),
        limit: 500,
      });
      bookings = response.items.filter(
        (b) => b.status !== "cancelled" && b.status !== "completed",
      );
      total = bookings.length;
    } else if (activeFilter.key === "all") {
      const response = await listBookings({
        from_date: fromDate.toISOString(),
        to_date: toDate.toISOString(),
        limit: 500,
      });
      bookings = response.items;
      total = response.total;
    } else {
      const response = await listBookings({
        from_date: fromDate.toISOString(),
        to_date: toDate.toISOString(),
        status: activeFilter.status,
        limit: 500,
      });
      bookings = response.items;
      total = response.total;
    }
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Fleet board unavailable. Try refreshing in a moment.";
  }

  const grouped = _groupByDay(bookings);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reservations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fleet board — bookings for the next {daysAhead} days. Group by
            departure date; sort by departure time within each day.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/reservations/customers"
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-muted/20"
          >
            Customers
          </Link>
          <Link
            href="/reservations/bookings/new"
            className="rounded-md border border-status-blue bg-status-blue/15 px-3 py-1.5 text-xs font-semibold text-status-blue hover:bg-status-blue/20"
          >
            + New Booking
          </Link>
        </div>
      </header>

      <StatusFilterBar active={activeFilter.key} daysAhead={daysAhead} />

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : bookings.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No bookings matching &ldquo;{activeFilter.label}&rdquo; in the
            next {daysAhead} days.
          </p>
          <p className="mt-2 text-xs text-muted-foreground/70">
            <Link
              href="/reservations/bookings/new"
              className="text-status-blue hover:underline"
            >
              File a new booking
            </Link>{" "}
            to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ label, items }) => (
            <DayGroup key={label} label={label} items={items} />
          ))}
        </div>
      )}

      <p className="mt-6 text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
        {total} booking{total === 1 ? "" : "s"}
      </p>
    </div>
  );
}

function StatusFilterBar({
  active,
  daysAhead,
}: {
  active: string;
  daysAhead: number;
}) {
  return (
    <nav
      aria-label="Filter by status"
      className="mb-4 flex flex-wrap items-center gap-1.5"
    >
      {STATUS_FILTERS.map((f) => {
        const isActive = f.key === active;
        const params = new URLSearchParams();
        if (f.key !== "open") params.set("status", f.key);
        if (daysAhead !== DEFAULT_DAYS_AHEAD)
          params.set("days", String(daysAhead));
        const qs = params.toString();
        const href = qs ? `/reservations?${qs}` : "/reservations";
        return (
          <Link
            key={f.key}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={
              "rounded-md border px-2.5 py-1 text-xs font-semibold transition " +
              (isActive
                ? "border-status-blue bg-status-blue/15 text-status-blue"
                : "border-border bg-card text-muted-foreground hover:text-foreground")
            }
          >
            {f.label}
          </Link>
        );
      })}
    </nav>
  );
}

function DayGroup({ label, items }: { label: string; items: Booking[] }) {
  return (
    <section>
      <header className="mb-2 flex items-baseline justify-between border-b border-border pb-1.5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.06em]">
          {label}
        </h2>
        <span className="text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
          {items.length} booking{items.length === 1 ? "" : "s"}
        </span>
      </header>
      <ul className="space-y-2">
        {items.map((b) => (
          <BookingRow key={b.id} b={b} />
        ))}
      </ul>
    </section>
  );
}

function BookingRow({ b }: { b: Booking }) {
  return (
    <li>
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
            {b.customer.company_name ? ` · ${b.customer.company_name}` : ""}{" "}
            · {b.pax_count} pax
          </p>
        </div>
        <StatusChip status={b.status} />
      </Link>
    </li>
  );
}

function StatusChip({ status }: { status: BookingStatus }) {
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

function _timeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function _groupByDay(
  items: Booking[],
): Array<{ label: string; items: Booking[] }> {
  const groups = new Map<string, Booking[]>();
  for (const b of items) {
    const d = new Date(b.requested_departure_at);
    const key = d.toDateString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(b);
  }
  // Sort the buckets by their date, oldest first.
  return Array.from(groups.entries())
    .sort(
      (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime(),
    )
    .map(([key, items]) => ({
      label: _dayLabel(key),
      items: items.sort(
        (x, y) =>
          new Date(x.requested_departure_at).getTime() -
          new Date(y.requested_departure_at).getTime(),
      ),
    }));
}

function _dayLabel(dateString: string): string {
  const d = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dNorm = new Date(d);
  dNorm.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (dNorm.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  const prefix =
    diffDays === 0 ? "Today · " : diffDays === 1 ? "Tomorrow · " : "";
  return prefix + d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
