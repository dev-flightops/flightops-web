import Link from "next/link";
import { routeText } from "@/lib/route";
import { LoadButtons } from "@/components/load-teams/load-buttons";
import { LoadStatusLine, loadStage } from "@/components/load-teams/load-status";
import { loadZoneTable } from "@/lib/api/auth";
import { formatZulu } from "@/lib/format/flight-time";
import { DEFAULT_TIME_ZONE, localClock, localDate, localDay, type ZoneTable, zoneFor } from "@/lib/format/local-time";

import {
  listFuelOrders,
  listGseUnits,
  listMyTeamLoads,
  listOpenStationIssues,
} from "@/lib/api/ground";
import { getFlightBoard } from "@/lib/api/flight-following";
import { ApiError } from "@/lib/api/client";
import type {
  BoardFlightItem,
  FlightAssignmentResponse,
  FuelOrderResponse,
  GSEUnitListItem,
  StationIssueResponse,
} from "@/lib/api/types";
import { equipmentTypeLabel } from "@/lib/ground/equipment-labels";

/**
 * /ramper — Ramp staff worklist.
 *
 * Where /ramp-ops is the dispatcher / ramp-lead overview (counts +
 * status across the whole operation), /ramper is the line-staff view:
 * a flat to-do list of "things I can action right now." Each row is
 * a single clear next step:
 *
 *   - The loads of the user's load teams: acknowledge, photograph and
 *     complete each (#134)
 *   - Fuel orders awaiting confirm / fueling
 *   - Aircraft departing soon (pre-flight checks reminder)
 *   - Open equipment squawks I might need to know about
 *   - Open station issues that affect today's ops
 *
 * No new backend — this page is a re-aggregation of ground-service +
 * ops-service data, restructured for ramp staff who shouldn't have to
 * dig through five tabs to find what's next.
 */
export default async function RamperPage() {
  const [
    confirmResult,
    fueledResult,
    boardResult,
    gseResult,
    issueResult,
    loadsResult,
    zonesResult,
  ] = await Promise.allSettled([
    // Enough that today's are all here when earlier days' are counted.
    listFuelOrders({ status: "ordered", limit: 100 }),
    listFuelOrders({ status: "confirmed", limit: 100 }),
    getFlightBoard("today"),
    listGseUnits({ limit: 200 }),
    listOpenStationIssues(),
    listMyTeamLoads(),
    loadZoneTable(),
  ]);
  const myLoads: FlightAssignmentResponse[] =
    loadsResult.status === "fulfilled"
      ? loadsResult.value.items.filter((a) => a.flight.status !== "completed" && a.flight.status !== "cancelled")
      : [];
  const zones = zonesResult.status === "fulfilled" ? zonesResult.value : null;

  // Orders for today and later, soonest first. One still open from an
  // earlier day is the fuel desk's to settle rather than the ramp's next
  // task: the demo's Ramper led with orders from August (#134). Those are
  // counted, with the way to them.
  const today = localDay(zones?.fallback ?? DEFAULT_TIME_ZONE);
  const due = (result: typeof confirmResult) => {
    const orders = result.status === "fulfilled" ? result.value.items : [];
    const current = orders
      .filter((o) => o.requested_fuel_date >= today)
      .sort((a, b) => fuelAt(a).localeCompare(fuelAt(b)));
    const total = result.status === "fulfilled" ? result.value.total : 0;
    return { current, earlier: Math.max(total - current.length, 0) };
  };
  const { current: awaitingConfirm, earlier: confirmEarlier } = due(confirmResult);
  const { current: awaitingFueled, earlier: fueledEarlier } = due(fueledResult);
  const todaysFlights: BoardFlightItem[] =
    boardResult.status === "fulfilled" ? boardResult.value.items : [];
  // Pre-flight: everything still on the ground. A released flight is the
  // one about to be loaded; only once it has departed is it off the list.
  const departingSoon = todaysFlights.filter(
    (f) => f.status === "scheduled" || (f.status === "released" && !f.actual_departure_at),
  );
  // GSE units with at least one open squawk. The cross-unit squawk feed
  // doesn't exist; we lean on the open_squawk_count aggregate the unit
  // list already exposes.
  const unitsWithSquawks: GSEUnitListItem[] =
    gseResult.status === "fulfilled"
      ? gseResult.value.items.filter((u) => u.open_squawk_count > 0)
      : [];
  const openIssues: StationIssueResponse[] =
    issueResult.status === "fulfilled" ? issueResult.value.items : [];

  const errors: string[] = [];
  const labelByResult = [
    ["Fuel orders", confirmResult],
    ["Fueling queue", fueledResult],
    ["Flight board", boardResult],
    ["Equipment", gseResult],
    ["Station issues", issueResult],
    ["Your team's loads", loadsResult],
  ] as const;
  for (const [label, r] of labelByResult) {
    if (r.status === "rejected") {
      const status = r.reason instanceof ApiError ? r.reason.status : 0;
      errors.push(
        status === 401
          ? "Session expired — please sign in again."
          : `${label} unavailable.`,
      );
    }
  }

  const openLoads = myLoads.filter((a) => loadStage(a) !== "complete");
  const totalTasks =
    openLoads.length +
    awaitingConfirm.length +
    awaitingFueled.length +
    departingSoon.length +
    unitsWithSquawks.length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="page-title">Ramper</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Your worklist — fuel orders, departing aircraft, and squawks
            that need attention right now
          </p>
        </div>
        <div className="flex min-w-0 flex-col border-l-2 border-input py-1 pl-3">
          <div className="font-display text-[1.75rem] font-extrabold leading-none tabular-nums text-foreground">
            {totalTasks}
          </div>
          <div className="eyebrow mt-1.5">
            Open tasks
          </div>
        </div>
      </header>

      {errors.length > 0 && (
        <div
          role="alert"
          className="mb-4 notice notice-yellow"
        >
          {errors.join(" ")}
        </div>
      )}

      <Section
        title="Your team's loads"
        emptyHint="No loads for your team today."
        actionHref="/ramp-ops"
        count={myLoads.length}
      >
        {myLoads.map((a) => {
          const zone = zones ? zoneFor(zones, a.flight.origin) : "America/Anchorage";
          return (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">
                  {a.flight.flight_number} • {a.flight.origin} → {a.flight.destination}
                </div>
                <div className="text-[0.7rem] text-muted-foreground">
                  {[a.flight.tail_number, a.flight.pax_count != null ? `${a.flight.pax_count} pax` : null,
                    `departs ${localClock(a.flight.scheduled_departure_at, zone)} (${formatZulu(a.flight.scheduled_departure_at)})`,
                    a.load_team.team_name].filter(Boolean).join(" • ")}
                </div>
                <LoadStatusLine assignment={a} timeZone={zone} className="mt-1 block" />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/ramper/${a.flight.id}/photos`} className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-primary hover:underline">
                  Photos{a.photo_count ? ` (${a.photo_count})` : ""} <span aria-hidden>›</span>
                </Link>
                <LoadButtons assignmentId={a.id} stage={loadStage(a)} flightNumber={a.flight.flight_number} />
              </div>
            </li>
          );
        })}
      </Section>

      <Section
        title="Confirm fuel orders"
        emptyHint="No orders waiting for supplier confirmation."
        actionHref="/fuel/orders?status=ordered"
        count={awaitingConfirm.length}
        note={earlierNote(confirmEarlier, "/fuel/orders?status=ordered", "confirm or cancel")}
      >
        {awaitingConfirm.map((o) => (
          <TaskRow
            key={o.id}
            href={`/fuel/orders/${o.id}`}
            primary={`${o.n_number} @ ${o.base_code}`}
            secondary={`${fuelWhen(o, today, zones)} • ${o.requested_quantity_gallons.toLocaleString()} gal • ${o.supplier_name_snapshot}`}
            cta="Confirm"
            tone="yellow"
          />
        ))}
      </Section>

      <Section
        title="Fuel & complete"
        emptyHint="Nothing in the fueling queue."
        actionHref="/fuel/orders?status=confirmed"
        count={awaitingFueled.length}
        note={earlierNote(fueledEarlier, "/fuel/orders?status=confirmed", "fuel or cancel")}
      >
        {awaitingFueled.map((o) => (
          <TaskRow
            key={o.id}
            href={`/fuel/orders/${o.id}`}
            primary={`${o.n_number} @ ${o.base_code}`}
            secondary={`${fuelWhen(o, today, zones)} • ${o.requested_quantity_gallons.toLocaleString()} gal • ${o.supplier_name_snapshot}`}
            cta="Mark fueled"
            tone="blue"
          />
        ))}
      </Section>

      <Section
        title="Departing today — pre-flight"
        emptyHint="No flights scheduled to depart today."
        actionHref="/flight-following"
        count={departingSoon.length}
      >
        {departingSoon.slice(0, 10).map((f) => (
          <TaskRow
            key={f.id}
            // Photo-capture is the ramp-staff entry point per flight
            // (mirrors legacy /ramper/flight/{id}/). Full turnaround
            // view (checklist + timers + notes) lands with Marc's M2
            // ramp backend.
            href={`/ramper/${f.id}/photos`}
            primary={`${f.flight_number} • ${routeText(f)}`}
            secondary={`${f.aircraft.tail_number} • ${f.pax_count} pax • departs ${departs(f, zones)}`}
            cta="Photos"
            tone="blue"
          />
        ))}
      </Section>

      <Section
        title="Equipment with open squawks"
        emptyHint="No GSE units have open squawks."
        actionHref="/equipment"
        count={unitsWithSquawks.length}
      >
        {unitsWithSquawks.slice(0, 10).map((u) => (
          <TaskRow
            key={u.id}
            href={`/equipment/${u.id}`}
            primary={u.name}
            secondary={`${equipmentTypeLabel(u.equipment_type)} • ${u.station?.name ?? "—"} • ${u.open_squawk_count} open`}
            cta="View"
            tone={u.status === "out_of_service" ? "red" : undefined}
          />
        ))}
      </Section>

      <Section
        title="Station issues"
        emptyHint="No open station issues."
        actionHref="/stations"
        count={openIssues.length}
      >
        {openIssues.slice(0, 10).map((i) => (
          <TaskRow
            key={i.id}
            href={`/stations/${i.station.id}`}
            primary={i.title}
            secondary={`${i.station.icao_code} • ${i.priority}`}
            cta="View"
            tone={
              i.priority === "critical" || i.priority === "high"
                ? "red"
                : undefined
            }
          />
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  emptyHint,
  actionHref,
  note,
  children,
}: {
  title: string;
  count: number;
  emptyHint: string;
  actionHref: string;
  /** A line under the list: what it leaves out. */
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <header className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.06em] text-foreground">
          {title}
          <span className="eyebrow">
            {count}
          </span>
        </h2>
        <Link
          href={actionHref}
          className="text-[0.7rem] font-semibold text-primary hover:underline"
        >
          See all →
        </Link>
      </header>
      {count === 0 ? (
        <p className="notice notice-gray text-muted-foreground">
          {emptyHint}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-md border border-border bg-card">
          {children}
        </ul>
      )}
      {note ? <p className="mt-1.5 text-xs text-muted-foreground">{note}</p> : null}
    </section>
  );
}

/** When the order is for, to sort by: its day, then the time it's
 *  needed (an instant), an order without one last in its day. */
function fuelAt(o: FuelOrderResponse): string {
  return `${o.requested_fuel_date} ${o.requested_fuel_time ?? "~"}`;
}

/** "Today 09:00 AKST", "Nov 5" or "Nov 5 14:30 AKST": when the fuel is
 *  wanted, at the base. */
function fuelWhen(o: FuelOrderResponse, today: string, zones: ZoneTable | null): string {
  const day = o.requested_fuel_date === today ? "Today" : localDate(`${o.requested_fuel_date}T12:00:00Z`, "UTC");
  if (!o.requested_fuel_time) return day;
  return `${day} ${localClock(o.requested_fuel_time, zones ? zoneFor(zones, o.base_code) : DEFAULT_TIME_ZONE)}`;
}

function earlierNote(count: number, href: string, what: string): React.ReactNode {
  if (count === 0) return null;
  return (
    <>
      {`${count} more ${count === 1 ? "is" : "are"} for earlier days and not listed: ${what} ${count === 1 ? "it" : "them"} in `}
      <Link href={href} className="font-semibold text-primary hover:underline">
        Fuel orders
      </Link>
      .
    </>
  );
}

/** "09:35 AKST (18:35z)": the origin's local time, then Zulu. */
function departs(f: BoardFlightItem, zones: ZoneTable | null): string {
  const zone = zones ? zoneFor(zones, f.origin) : DEFAULT_TIME_ZONE;
  return `${localClock(f.scheduled_departure_at, zone)} (${formatZulu(f.scheduled_departure_at)})`;
}

function TaskRow({
  href,
  primary,
  secondary,
  cta,
  tone,
}: {
  href: string;
  primary: string;
  secondary: string;
  cta: string;
  tone?: "yellow" | "blue" | "red";
}) {
  const ctaClass =
    tone === "yellow"
      ? "text-status-yellow"
      : tone === "blue"
        ? "text-status-blue"
        : tone === "red"
          ? "text-status-red"
          : "text-primary";
  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        href={href}
        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent"
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">{primary}</div>
          <div className="text-[0.7rem] text-muted-foreground">{secondary}</div>
        </div>
        <span
          className={`shrink-0 text-[0.68rem] font-bold uppercase tracking-[0.1em] ${ctaClass}`}
        >
          {cta} <span aria-hidden>›</span>
        </span>
      </Link>
    </li>
  );
}
