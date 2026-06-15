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
 * /ramp-ops — Daily Ramp Ops dashboard.
 *
 * Mirrors the legacy "Ramp Operations" landing — a single screen the
 * ramp lead can glance at to see what needs attention today: open
 * fuel orders awaiting confirm/fueled, equipment out of service or
 * scheduled for maintenance, open station issues, and today's
 * inbound/outbound flights.
 *
 * No new backend — this is purely a re-aggregation of data already
 * exposed by ground-service + ops-service. The deep-link CTAs on each
 * card route to the existing detail pages.
 */
export default async function RampOpsPage() {
  const [
    fuelResult,
    gseResult,
    issuesResult,
    boardResult,
  ] = await Promise.allSettled([
    Promise.all([
      listFuelOrders({ status: "ordered", limit: 50 }),
      listFuelOrders({ status: "confirmed", limit: 50 }),
    ]),
    listGseUnits({ limit: 200 }),
    listOpenStationIssues(),
    getFlightBoard("today"),
  ]);

  let openOrders: FuelOrderResponse[] = [];
  let pendingConfirmCount = 0;
  let pendingFueledCount = 0;
  if (fuelResult.status === "fulfilled") {
    const [ordered, confirmed] = fuelResult.value;
    pendingConfirmCount = ordered.total;
    pendingFueledCount = confirmed.total;
    // Merge — newest first, capped at 8 for the visible card list.
    openOrders = [...ordered.items, ...confirmed.items]
      .sort((a, b) =>
        a.requested_at < b.requested_at ? 1 : -1,
      )
      .slice(0, 8);
  }

  const gseUnits: GSEUnitListItem[] =
    gseResult.status === "fulfilled" ? gseResult.value.items : [];
  const gseDown = gseUnits.filter((u) => u.status === "out_of_service");
  const gseMaint = gseUnits.filter((u) => u.status === "maintenance");

  const stationIssues: StationIssueResponse[] =
    issuesResult.status === "fulfilled" ? issuesResult.value.items : [];

  const flightsToday: BoardFlightItem[] =
    boardResult.status === "fulfilled" ? boardResult.value.items : [];
  const departingToday = flightsToday.filter(
    (f) => f.status === "scheduled" || f.status === "released",
  );

  const errors: string[] = [];
  const labelByResult = [
    ["Fuel orders", fuelResult],
    ["Equipment", gseResult],
    ["Station issues", issuesResult],
    ["Flight board", boardResult],
  ] as const;
  for (const [label, r] of labelByResult) {
    if (r.status === "rejected") {
      const status =
        r.reason instanceof ApiError ? r.reason.status : 0;
      errors.push(
        status === 401
          ? "Session expired — please sign in again."
          : `${label} unavailable.`,
      );
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Ramp Ops</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Today&apos;s ramp activity at a glance — fuel queue, equipment
          status, station issues, and flight movements
        </p>
      </header>

      {errors.length > 0 && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          {errors.join(" ")}
        </div>
      )}

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile
          label="Awaiting confirm"
          value={pendingConfirmCount}
          accent={pendingConfirmCount > 0 ? "yellow" : undefined}
        />
        <StatTile
          label="Awaiting fueling"
          value={pendingFueledCount}
          accent={pendingFueledCount > 0 ? "blue" : undefined}
        />
        <StatTile
          label="Equipment down"
          value={gseDown.length}
          accent={gseDown.length > 0 ? "red" : undefined}
        />
        <StatTile label="In maintenance" value={gseMaint.length} />
        <StatTile
          label="Open station issues"
          value={stationIssues.length}
          accent={stationIssues.length > 0 ? "yellow" : undefined}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Fuel queue" actionHref="/fuel/orders" actionLabel="All orders →">
          {openOrders.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No open fuel orders.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {openOrders.map((o) => (
                <li key={o.id} className="py-2.5">
                  <Link
                    href={`/fuel/orders/${o.id}`}
                    className="flex items-center justify-between gap-3 hover:bg-muted/10"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-mono font-semibold">
                          {o.n_number}
                        </span>
                        <span className="text-muted-foreground">
                          @ {o.base_code}
                        </span>
                      </div>
                      <div className="text-[0.7rem] text-muted-foreground">
                        {o.supplier_name_snapshot} •{" "}
                        {o.fuel_type_label_snapshot} •{" "}
                        {o.requested_quantity_gallons.toLocaleString()} gal
                      </div>
                    </div>
                    <StatusChip status={o.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Equipment status"
          actionHref="/equipment"
          actionLabel="All equipment →"
        >
          {gseDown.length === 0 && gseMaint.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              All units operational.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {[...gseDown, ...gseMaint].slice(0, 8).map((u) => (
                <li key={u.id} className="py-2.5">
                  <Link
                    href={`/equipment/${u.id}`}
                    className="flex items-center justify-between gap-3 hover:bg-muted/10"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">
                        {u.name}
                      </div>
                      <div className="text-[0.7rem] text-muted-foreground">
                        {u.equipment_type} • {u.station?.name ?? "—"}
                      </div>
                    </div>
                    <GseStatusChip status={u.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Open station issues"
          actionHref="/stations"
          actionLabel="All stations →"
        >
          {stationIssues.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No open issues at any station.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {stationIssues.slice(0, 8).map((i) => (
                <li key={i.id} className="py-2.5">
                  <Link
                    href={`/stations/${i.station.id}`}
                    className="flex items-center justify-between gap-3 hover:bg-muted/10"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">
                        {i.title}
                      </div>
                      <div className="text-[0.7rem] text-muted-foreground">
                        {i.station.icao_code} • {i.priority}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Today's flights"
          actionHref="/flight-following"
          actionLabel="Flight Following →"
        >
          {departingToday.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No flights scheduled for today.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {departingToday.slice(0, 8).map((f) => (
                <li key={f.id} className="py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold">
                          {f.flight_number}
                        </span>
                        <span className="text-muted-foreground">
                          {f.origin} → {f.destination}
                        </span>
                      </div>
                      <div className="text-[0.7rem] text-muted-foreground">
                        {f.aircraft.tail_number} • {f.pax_count} pax
                      </div>
                    </div>
                    <span className="text-[0.7rem] text-muted-foreground">
                      {formatTime(f.scheduled_departure_at)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "yellow" | "blue" | "red";
}) {
  const valueClass =
    accent === "yellow"
      ? "text-status-yellow"
      : accent === "blue"
        ? "text-status-blue"
        : accent === "red"
          ? "text-status-red"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 text-center">
      <div className={`text-2xl font-bold leading-none ${valueClass}`}>
        {value}
      </div>
      <div className="mt-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function Card({
  title,
  actionHref,
  actionLabel,
  children,
}: {
  title: string;
  actionHref: string;
  actionLabel: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.06em] text-foreground">
          {title}
        </h3>
        <Link
          href={actionHref}
          className="text-[0.7rem] font-semibold text-status-blue hover:underline"
        >
          {actionLabel}
        </Link>
      </header>
      {children}
    </article>
  );
}

function StatusChip({ status }: { status: string }) {
  const palette: Record<string, string> = {
    ordered:
      "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
    confirmed:
      "border-status-blue/40 bg-status-blue/10 text-status-blue",
    fueled:
      "border-status-green/40 bg-status-green/10 text-status-green",
    discrepancy:
      "border-status-red/40 bg-status-red/10 text-status-red",
    cancelled: "border-border bg-muted/30 text-muted-foreground",
  };
  const className =
    palette[status] ?? "border-border bg-muted/30 text-muted-foreground";
  return (
    <span
      className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] ${className}`}
    >
      {status}
    </span>
  );
}

function GseStatusChip({ status }: { status: string }) {
  const palette: Record<string, string> = {
    operational:
      "border-status-green/40 bg-status-green/10 text-status-green",
    maintenance:
      "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
    out_of_service:
      "border-status-red/40 bg-status-red/10 text-status-red",
  };
  return (
    <span
      className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] ${
        palette[status] ?? "border-border bg-muted/30 text-muted-foreground"
      }`}
    >
      {status.replace(/_/g, " ")}
    </span>
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
