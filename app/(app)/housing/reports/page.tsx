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
import {
  costByEmployee,
  dayCount,
  employeeHistory,
  occupancyByUnit,
} from "@/lib/housing/reports";

import { ExportButton } from "./export-button";

/**
 * /housing/reports — Housing Reports.
 *
 * Legacy's `/housing/reports` with the same three tabs: Occupancy,
 * Employee History, Cost Tracking, each over a date range with a CSV
 * export.
 *
 * WHY THE ARITHMETIC IS NOT THE SERVICE'S
 *
 * housing-service exposes `GET /housing/occupancy`, but that is a
 * single-date snapshot — who is in the building tonight. A utilisation
 * report needs room-nights across a range, so the aggregation happens
 * in `lib/housing/reports.ts` over the booking list, which is the same
 * source legacy aggregates. It is pure and tested there; this file
 * fetches and renders.
 *
 * WHAT THE DASHES MEAN
 *
 * An em-dash in a Nights or Cost cell means "not computable", not
 * zero. A stay with no check-out has no total yet, and a room nobody
 * priced is not a free room — printing 0 in either case would put a
 * wrong number in front of somebody reconciling an invoice. The CSV
 * leaves those cells empty for the same reason.
 */
export const dynamic = "force-dynamic";

const TABS = [
  { key: "occupancy", label: "Occupancy" },
  { key: "history", label: "Employee History" },
  { key: "cost", label: "Cost Tracking" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Default window: the current calendar month, which is the period an
 *  operator reconciles housing against. */
function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1));
  const last = new Date(Date.UTC(y, m + 1, 0));
  return { from: iso(first), to: iso(last) };
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function money(n: number): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function HousingReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const tab: TabKey =
    TABS.find((t) => t.key === params.tab)?.key ?? "occupancy";

  const fallback = defaultRange();
  // A malformed date in the URL falls back rather than being passed to
  // the API, where it would either 422 or be silently reinterpreted.
  const from = ISO_DATE.test(params.from ?? "") ? params.from! : fallback.from;
  const to = ISO_DATE.test(params.to ?? "") ? params.to! : fallback.to;
  const backwards = from > to;

  let units: HousingUnit[] = [];
  let rooms: HousingRoom[] = [];
  let bookings: HousingBooking[] = [];
  let loadError: string | null = null;

  if (!backwards) {
    try {
      const [unitsResp, bookingsResp] = await Promise.all([
        listHousingUnits(),
        // Cancelled bookings are included so Employee History can show
        // them — it is a record of what happened. The occupancy and
        // cost figures filter them out.
        listHousingBookings({ from, to, includeCancelled: true }),
      ]);
      units = unitsResp.items;
      bookings = bookingsResp.items;
      // Rooms are per-unit on the service, and the denominator of the
      // occupancy report is the room count, so they have to be
      // fetched. One request per house, in parallel.
      const details = await Promise.all(
        units.map((u) => getHousingUnit(u.id).catch(() => null)),
      );
      rooms = details.flatMap((d) => d?.rooms ?? []);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      loadError =
        status === 401
          ? "Your session expired — please sign in again."
          : "Housing reports unavailable. Try refreshing in a moment.";
    }
  }

  const nights = dayCount(from, to);
  const occupancy = occupancyByUnit(units, rooms, bookings, from, to);
  const history = employeeHistory(bookings, rooms);
  const cost = costByEmployee(bookings, rooms, from, to);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
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
        <Link href="/housing" className="text-muted-foreground hover:text-foreground">
          Housing
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">
          ›
        </span>
        <span className="font-semibold text-primary">Reports</span>
      </nav>

      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Housing Reports</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Occupancy, employee history and cost over a date range —{" "}
          {nights} night{nights === 1 ? "" : "s"}
          {units.length > 0 && (
            <span className="text-muted-foreground/70">
              {" "}
              · {units.length} house{units.length === 1 ? "" : "s"} ·{" "}
              {rooms.length} room{rooms.length === 1 ? "" : "s"}
            </span>
          )}
        </p>
      </header>

      <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Report">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={`/housing/reports?tab=${t.key}&from=${from}&to=${to}`}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white"
                  : "rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              }
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <form
        method="get"
        className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card px-4 py-3"
      >
        <input type="hidden" name="tab" value={tab} />
        <label className="block">
          <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            From
          </span>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            To
          </span>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="rounded-md border border-border bg-muted/30 px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/50"
        >
          Generate
        </button>
        <ExportButton
          tab={tab}
          from={from}
          to={to}
          disabled={Boolean(loadError) || backwards}
        />
      </form>

      {backwards ? (
        <div
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
        >
          The start date is after the end date, so there is no period to
          report on. Swap them and press Generate.
        </div>
      ) : loadError ? (
        <div
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      ) : tab === "occupancy" ? (
        <OccupancyTable rows={occupancy} />
      ) : tab === "history" ? (
        <HistoryTable rows={history} />
      ) : (
        <CostTable report={cost} />
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

const TH =
  "px-4 py-3 text-left text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";
const TD = "px-4 py-2.5 text-sm text-foreground";

function OccupancyTable({
  rows,
}: {
  rows: ReturnType<typeof occupancyByUnit>;
}) {
  if (rows.length === 0) {
    return <Empty>No houses yet. Add one to report on it.</Empty>;
  }
  return (
    <Card>
      <table className="w-full">
        <thead className="border-b border-border">
          <tr>
            <th scope="col" className={TH}>House</th>
            <th scope="col" className={TH}>Station</th>
            <th scope="col" className={`${TH} text-right`}>Rooms</th>
            <th scope="col" className={`${TH} text-right`}>Room-nights</th>
            <th scope="col" className={`${TH} text-right`}>Occupied</th>
            <th scope="col" className={`${TH} text-right`}>Occupancy</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.unitId} className="border-b border-border last:border-0">
              <td className={`${TD} font-semibold`}>{r.unitName}</td>
              <td className={`${TD} font-mono text-xs text-muted-foreground`}>
                {r.station}
              </td>
              <td className={`${TD} text-right tabular-nums`}>{r.rooms}</td>
              <td className={`${TD} text-right tabular-nums`}>{r.roomNights}</td>
              <td className={`${TD} text-right tabular-nums`}>
                {r.occupiedNights}
              </td>
              <td className={`${TD} text-right tabular-nums`}>
                {r.occupancyPct === null ? (
                  // No rooms entered, so there is no denominator. This
                  // is not a house running at 0%.
                  <span
                    className="text-muted-foreground"
                    title="No rooms entered for this house, so occupancy cannot be calculated"
                  >
                    not measured
                  </span>
                ) : (
                  `${r.occupancyPct.toFixed(1)}%`
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function HistoryTable({ rows }: { rows: ReturnType<typeof employeeHistory> }) {
  if (rows.length === 0) {
    return <Empty>No bookings in this period.</Empty>;
  }
  return (
    <Card>
      <table className="w-full">
        <thead className="border-b border-border">
          <tr>
            <th scope="col" className={TH}>Employee</th>
            <th scope="col" className={TH}>House</th>
            <th scope="col" className={TH}>Room</th>
            <th scope="col" className={TH}>Check in</th>
            <th scope="col" className={TH}>Check out</th>
            <th scope="col" className={`${TH} text-right`}>Nights</th>
            <th scope="col" className={`${TH} text-right`}>Cost</th>
            <th scope="col" className={TH}>Purpose</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.bookingId}
              className="border-b border-border last:border-0"
            >
              <td className={`${TD} font-semibold`}>
                {r.employee}
                {r.isCancelled && (
                  <span className="ml-2 rounded bg-status-red/10 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-status-red">
                    Cancelled
                  </span>
                )}
              </td>
              <td className={TD}>{r.unitName}</td>
              <td className={`${TD} font-mono text-xs`}>{r.roomNumber}</td>
              <td className={`${TD} tabular-nums`}>{r.checkIn}</td>
              <td className={`${TD} tabular-nums`}>
                {r.checkOut ?? (
                  <span className="text-muted-foreground" title="Still resident">
                    open
                  </span>
                )}
              </td>
              <td className={`${TD} text-right tabular-nums`}>
                {r.nights ?? <span className="text-muted-foreground">—</span>}
              </td>
              <td className={`${TD} text-right tabular-nums`}>
                {r.cost === null ? (
                  <span
                    className="text-muted-foreground"
                    title="Needs a finished stay and a nightly rate on the room"
                  >
                    —
                  </span>
                ) : (
                  money(r.cost)
                )}
              </td>
              <td className={`${TD} text-xs text-muted-foreground`}>
                {r.purpose
                  ? (BOOKING_PURPOSE_LABELS[r.purpose as BookingPurpose] ??
                    r.purpose)
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function CostTable({ report }: { report: ReturnType<typeof costByEmployee> }) {
  if (report.rows.length === 0) {
    return <Empty>No bookings in this period.</Empty>;
  }
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Total housing cost
        </div>
        <div className="mt-0.5 text-2xl font-bold tabular-nums text-foreground">
          {money(report.total)}
        </div>
        {report.unpricedBookings > 0 && (
          // Saying the total is partial, rather than presenting it as
          // complete. A room with no nightly rate contributes nothing
          // to the sum, which understates it silently otherwise.
          <p className="mt-1 text-xs text-status-yellow">
            Excludes {report.unpricedBookings} booking
            {report.unpricedBookings === 1 ? "" : "s"} in rooms with no
            nightly rate set — the total is lower than the real cost.
          </p>
        )}
      </div>
      <Card>
        <table className="w-full">
          <thead className="border-b border-border">
            <tr>
              <th scope="col" className={TH}>Employee</th>
              <th scope="col" className={`${TH} text-right`}>Nights</th>
              <th scope="col" className={`${TH} text-right`}>Cost</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((r) => (
              <tr
                key={r.employee}
                className="border-b border-border last:border-0"
              >
                <td className={`${TD} font-semibold`}>
                  {r.employee}
                  {r.unpricedBookings > 0 && (
                    <span
                      className="ml-2 text-[0.65rem] text-status-yellow"
                      title="Booked into a room with no nightly rate"
                    >
                      {r.unpricedBookings} unpriced
                    </span>
                  )}
                </td>
                <td className={`${TD} text-right tabular-nums`}>{r.nights}</td>
                <td className={`${TD} text-right tabular-nums`}>
                  {money(r.cost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
