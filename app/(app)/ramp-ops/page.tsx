import Link from "next/link";

import { listCompanyBases } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { getFlightBoard } from "@/lib/api/flight-following";
import { listLoadTeams } from "@/lib/api/ground";
import type {
  BoardFlightItem,
  CompanyBaseResponse,
  LoadTeamResponse,
} from "@/lib/api/types";

import { BaseFilter } from "./base-filter";

/**
 * /ramp-ops — Ramp Operations (legacy parity).
 *
 * Daily flight-to-load-team assignment workspace. Two columns:
 *
 *   Today's Flights        Load Teams
 *   ──────────────────     ──────────────────
 *   (one card per flight)  (one card per team)
 *   draggable target       drop targets
 *
 * Header carries an "All Bases" filter that scopes the flight list
 * to a single ICAO (origin or destination match), plus a right-
 * aligned `<weekday>, <month> <day> · N flights` summary.
 *
 * Drag-to-assign + the assignment row are M2-M-25e backend work —
 * until that lands, each flight card carries an "Assign team" affordance
 * that's disabled with a hint. The team column shows the existing
 * LoadTeam directory read-only.
 */
export default async function RampOpsPage({
  searchParams,
}: {
  searchParams: Promise<{ base?: string }>;
}) {
  const { base: baseFilterRaw } = await searchParams;
  const baseFilter = baseFilterRaw?.trim().toUpperCase() || null;

  const [basesResult, flightsResult, teamsResult] = await Promise.allSettled([
    listCompanyBases(),
    getFlightBoard("today"),
    listLoadTeams({ baseIcao: baseFilter ?? undefined }),
  ]);

  const bases: CompanyBaseResponse[] =
    basesResult.status === "fulfilled"
      ? basesResult.value.items.filter((b) => b.is_active)
      : [];

  let flights: BoardFlightItem[] =
    flightsResult.status === "fulfilled" ? flightsResult.value.items : [];
  if (baseFilter) {
    flights = flights.filter(
      (f) => f.origin === baseFilter || f.destination === baseFilter,
    );
  }

  const teams: LoadTeamResponse[] =
    teamsResult.status === "fulfilled"
      ? teamsResult.value.items.filter((t) => t.is_active)
      : [];

  const errors: string[] = [];
  for (const [label, r] of [
    ["Bases", basesResult],
    ["Today's flights", flightsResult],
    ["Load teams", teamsResult],
  ] as const) {
    if (r.status === "rejected") {
      const status = r.reason instanceof ApiError ? r.reason.status : 0;
      errors.push(
        status === 401
          ? "Session expired — please sign in again."
          : `${label} unavailable.`,
      );
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <PageHeader bases={bases} baseFilter={baseFilter} flightCount={flights.length} />

      {errors.length > 0 && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          {errors.join(" ")}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <FlightsColumn flights={flights} hasTeams={teams.length > 0} />
        <TeamsColumn teams={teams} baseFilter={baseFilter} />
      </div>
    </div>
  );
}

// ---- Header -----------------------------------------------------------------

function PageHeader({
  bases,
  baseFilter,
  flightCount,
}: {
  bases: CompanyBaseResponse[];
  baseFilter: string | null;
  flightCount: number;
}) {
  const today = new Date();
  const formatted = today.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Ramp Operations</h1>
        <BaseFilter bases={bases} active={baseFilter} />
      </div>
      <div className="text-xs text-muted-foreground">
        {formatted} · {flightCount}{" "}
        {flightCount === 1 ? "flight" : "flights"}
      </div>
    </header>
  );
}

// ---- Flights column ---------------------------------------------------------

function FlightsColumn({
  flights,
  hasTeams,
}: {
  flights: BoardFlightItem[];
  hasTeams: boolean;
}) {
  return (
    <section>
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Today&apos;s Flights</h2>
        <span
          className="text-[0.7rem] text-muted-foreground"
          title={
            hasTeams
              ? "Drag-to-assign + the Assign button are gated on M2-M-25e (FlightLoadTeamAssignment backend)."
              : "Create a load team first so you have something to assign to."
          }
        >
          Drag to assign
        </span>
      </header>
      {flights.length === 0 ? (
        <EmptyCard>No flights today.</EmptyCard>
      ) : (
        <ul className="space-y-2">
          {flights.map((f) => (
            <FlightCard key={f.id} flight={f} />
          ))}
        </ul>
      )}
    </section>
  );
}

function FlightCard({ flight: f }: { flight: BoardFlightItem }) {
  const time = formatTime(f.scheduled_departure_at);
  return (
    <li>
      <article
        className="rounded-md border border-border bg-card p-3 hover:border-status-blue/60"
        aria-grabbed="false"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm">
              <Link
                href={`/dispatch/${f.id}`}
                className="font-mono font-semibold text-foreground hover:underline"
              >
                {f.flight_number}
              </Link>
              <span className="text-muted-foreground">
                {f.origin} → {f.destination}
              </span>
              <StatusChip status={f.status} />
            </div>
            <div className="mt-1 text-[0.7rem] text-muted-foreground">
              {f.aircraft.tail_number} · {f.pax_count} pax · {f.cargo_lbs} lb
              cargo · {time}
            </div>
          </div>
          <button
            type="button"
            disabled
            title="Assignment lands in M2-M-25e"
            className="shrink-0 cursor-not-allowed rounded-md border border-dashed border-border bg-card/40 px-2.5 py-1 text-[0.65rem] font-semibold text-muted-foreground"
          >
            Assign team
          </button>
        </div>
      </article>
    </li>
  );
}

// ---- Teams column -----------------------------------------------------------

function TeamsColumn({
  teams,
  baseFilter,
}: {
  teams: LoadTeamResponse[];
  baseFilter: string | null;
}) {
  return (
    <section>
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Load Teams</h2>
        {baseFilter && (
          <span className="text-[0.7rem] text-muted-foreground">
            Filtered to {baseFilter}
          </span>
        )}
      </header>
      {teams.length === 0 ? (
        <EmptyCard>
          No teams.{" "}
          <Link
            href="/settings/load-teams"
            className="font-semibold text-status-blue hover:underline"
            title="Load team management UI lands with M2-M-25e"
          >
            Create teams →
          </Link>
        </EmptyCard>
      ) : (
        <ul className="space-y-2">
          {teams.map((t) => (
            <TeamCard key={t.id} team={t} />
          ))}
        </ul>
      )}
    </section>
  );
}

function TeamCard({ team }: { team: LoadTeamResponse }) {
  return (
    <li>
      <article className="rounded-md border border-border bg-card p-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-1.5 inline-block h-3 w-3 shrink-0 rounded-sm"
            style={{ backgroundColor: team.color_code }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {team.team_name}
              </h3>
              <span className="font-mono text-[0.7rem] text-muted-foreground">
                {team.base_icao}
              </span>
            </div>
            <div className="mt-1 text-[0.7rem] text-muted-foreground">
              {team.team_lead?.full_name ? (
                <>Lead: {team.team_lead.full_name} · </>
              ) : null}
              {team.member_count}{" "}
              {team.member_count === 1 ? "member" : "members"}
            </div>
            {team.notes && (
              <p className="mt-1 text-[0.7rem] text-muted-foreground/80">
                {team.notes}
              </p>
            )}
          </div>
        </div>
      </article>
    </li>
  );
}

// ---- Shared bits ------------------------------------------------------------

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-8 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const palette: Record<string, string> = {
    scheduled: "border-border bg-muted/30 text-muted-foreground",
    released:
      "border-status-blue/40 bg-status-blue/10 text-status-blue",
    completed:
      "border-status-green/40 bg-status-green/10 text-status-green",
    cancelled: "border-border bg-muted/30 text-muted-foreground/70",
  };
  return (
    <span
      className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.08em] ${
        palette[status] ?? "border-border bg-muted/30 text-muted-foreground"
      }`}
    >
      {status}
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
