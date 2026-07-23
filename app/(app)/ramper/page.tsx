import Link from "next/link";

import {
  listFuelOrders,
  listGseUnits,
  listOpenStationIssues,
} from "@/lib/api/ground";
import { getFlightBoard } from "@/lib/api/flight-following";
import { ApiError } from "@/lib/api/client";
import type {
  BoardFlightItem,
  FuelOrderResponse,
  GSEUnitListItem,
  StationIssueResponse,
} from "@/lib/api/types";

/**
 * /ramper — Ramp staff worklist.
 *
 * Where /ramp-ops is the dispatcher / ramp-lead overview (counts +
 * status across the whole operation), /ramper is the line-staff view:
 * a flat to-do list of "things I can action right now." Each row is
 * a single clear next step:
 *
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
  ] = await Promise.allSettled([
    listFuelOrders({ status: "ordered", limit: 20 }),
    listFuelOrders({ status: "confirmed", limit: 20 }),
    getFlightBoard("today"),
    listGseUnits({ limit: 200 }),
    listOpenStationIssues(),
  ]);

  const awaitingConfirm: FuelOrderResponse[] =
    confirmResult.status === "fulfilled" ? confirmResult.value.items : [];
  const awaitingFueled: FuelOrderResponse[] =
    fueledResult.status === "fulfilled" ? fueledResult.value.items : [];
  const todaysFlights: BoardFlightItem[] =
    boardResult.status === "fulfilled" ? boardResult.value.items : [];
  // Pre-flight reminder: scheduled flights only — released ones are
  // already in the air and not the ramper's worry today.
  const departingSoon = todaysFlights.filter((f) => f.status === "scheduled");
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

  const totalTasks =
    awaitingConfirm.length +
    awaitingFueled.length +
    departingSoon.length +
    unitsWithSquawks.length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ramper</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your worklist — fuel orders, departing aircraft, and squawks
            that need attention right now
          </p>
        </div>
        <div className="rounded-md border border-border bg-card px-4 py-2 text-center">
          <div className="text-2xl font-bold leading-none text-foreground">
            {totalTasks}
          </div>
          <div className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Open tasks
          </div>
        </div>
      </header>

      {errors.length > 0 && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          {errors.join(" ")}
        </div>
      )}

      <Section
        title="Confirm fuel orders"
        emptyHint="No orders waiting for supplier confirmation."
        actionHref="/fuel/orders?status=ordered"
        count={awaitingConfirm.length}
      >
        {awaitingConfirm.map((o) => (
          <TaskRow
            key={o.id}
            href={`/fuel/orders/${o.id}`}
            primary={`${o.n_number} @ ${o.base_code}`}
            secondary={`${o.requested_quantity_gallons.toLocaleString()} gal • ${o.supplier_name_snapshot}`}
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
      >
        {awaitingFueled.map((o) => (
          <TaskRow
            key={o.id}
            href={`/fuel/orders/${o.id}`}
            primary={`${o.n_number} @ ${o.base_code}`}
            secondary={`${o.requested_quantity_gallons.toLocaleString()} gal • ${o.supplier_name_snapshot}`}
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
            primary={`${f.flight_number} • ${f.origin} → ${f.destination}`}
            secondary={`${f.aircraft.tail_number} • ${f.pax_count} pax • ${formatTime(f.scheduled_departure_at)}`}
            cta="📷 Photos"
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
            secondary={`${u.equipment_type} • ${u.station?.name ?? "—"} • ${u.open_squawk_count} open`}
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
  children,
}: {
  title: string;
  count: number;
  emptyHint: string;
  actionHref: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <header className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.06em] text-foreground">
          {title}
          <span className="rounded-sm border border-border bg-muted/30 px-1.5 py-0.5 text-[0.55rem] font-semibold text-muted-foreground">
            {count}
          </span>
        </h2>
        <Link
          href={actionHref}
          className="text-[0.7rem] font-semibold text-status-blue hover:underline"
        >
          See all →
        </Link>
      </header>
      {count === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-card/40 px-4 py-3 text-xs text-muted-foreground">
          {emptyHint}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-md border border-border bg-card">
          {children}
        </ul>
      )}
    </section>
  );
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
      ? "border-status-yellow/40 bg-status-yellow/10 text-status-yellow"
      : tone === "blue"
        ? "border-status-blue/40 bg-status-blue/10 text-status-blue"
        : tone === "red"
          ? "border-status-red/40 bg-status-red/10 text-status-red"
          : "border-border bg-muted/30 text-foreground";
  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        href={href}
        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/10"
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">{primary}</div>
          <div className="text-[0.7rem] text-muted-foreground">{secondary}</div>
        </div>
        <span
          className={`shrink-0 rounded-md border px-2 py-1 text-[0.65rem] font-semibold ${ctaClass}`}
        >
          {cta} →
        </span>
      </Link>
    </li>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
