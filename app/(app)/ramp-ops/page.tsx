import Link from "next/link";

import { listCompanyBases } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { getFlightBoard } from "@/lib/api/flight-following";
import { listAssignmentsByTeam, listLoadTeams } from "@/lib/api/ground";
import type {
  BoardFlightItem,
  CompanyBaseResponse,
  FlightAssignmentResponse,
  LoadTeamResponse,
} from "@/lib/api/types";

import { AssignTeamDropdown } from "./assign-team-dropdown";
import { BaseFilter } from "./base-filter";

/**
 * /ramp-ops — Ramp Operations (legacy parity, with M2-M-25e wired).
 *
 * Daily flight-to-load-team assignment workspace. Two columns:
 *
 *   Today's Flights        Load Teams
 *   ──────────────────     ──────────────────
 *   per-flight card        per-team card
 *   • Assign team dropdown • lists flights currently on the team
 *
 * Header: All Bases filter + right-aligned `<weekday>, <month> <day>
 * · N flights` summary.
 *
 * Assignment state comes from /ground/flight-assignments — we fan out
 * one call per active team and build a flight→team lookup so flight
 * cards can render their current assignment chip without a per-flight
 * round-trip.
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

  // Fan out one assignment fetch per team — parallel, capped by team
  // count (small N for an op). Build both maps from the results so
  // flight cards can show their current team chip and team cards can
  // list assigned flights.
  const assignmentsByTeam = new Map<string, FlightAssignmentResponse[]>();
  const teamByFlightId = new Map<string, LoadTeamResponse>();
  let assignmentError = false;
  const assignmentResults = await Promise.allSettled(
    teams.map((t) => listAssignmentsByTeam(t.id)),
  );
  assignmentResults.forEach((r, i) => {
    const team = teams[i];
    if (r.status === "fulfilled") {
      assignmentsByTeam.set(team.id, r.value.items);
      for (const a of r.value.items) {
        teamByFlightId.set(a.flight.id, team);
      }
    } else {
      assignmentError = true;
    }
  });

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
  if (assignmentError) errors.push("Some team assignments unavailable.");

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
        <FlightsColumn
          flights={flights}
          teams={teams}
          teamByFlightId={teamByFlightId}
        />
        <TeamsColumn
          teams={teams}
          assignmentsByTeam={assignmentsByTeam}
          baseFilter={baseFilter}
        />
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
  teams,
  teamByFlightId,
}: {
  flights: BoardFlightItem[];
  teams: LoadTeamResponse[];
  teamByFlightId: Map<string, LoadTeamResponse>;
}) {
  return (
    <section>
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Today&apos;s Flights</h2>
        <span className="text-[0.7rem] text-muted-foreground">
          Click Assign team to place a flight
        </span>
      </header>
      {flights.length === 0 ? (
        <EmptyCard>No flights today.</EmptyCard>
      ) : (
        <ul className="space-y-2">
          {flights.map((f) => (
            <FlightCard
              key={f.id}
              flight={f}
              teams={teams}
              currentTeam={teamByFlightId.get(f.id) ?? null}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function FlightCard({
  flight: f,
  teams,
  currentTeam,
}: {
  flight: BoardFlightItem;
  teams: LoadTeamResponse[];
  currentTeam: LoadTeamResponse | null;
}) {
  const time = formatTime(f.scheduled_departure_at);
  return (
    <li>
      <article className="rounded-md border border-border bg-card p-3 hover:border-status-blue/60">
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
          <AssignTeamDropdown
            flightId={f.id}
            flightOrigin={f.origin}
            teams={teams}
            currentTeam={currentTeam}
          />
        </div>
      </article>
    </li>
  );
}

// ---- Teams column -----------------------------------------------------------

function TeamsColumn({
  teams,
  assignmentsByTeam,
  baseFilter,
}: {
  teams: LoadTeamResponse[];
  assignmentsByTeam: Map<string, FlightAssignmentResponse[]>;
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
            title="Load team management UI lands with a follow-up settings story"
          >
            Create teams →
          </Link>
        </EmptyCard>
      ) : (
        <ul className="space-y-2">
          {teams.map((t) => (
            <TeamCard
              key={t.id}
              team={t}
              assignments={assignmentsByTeam.get(t.id) ?? []}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function TeamCard({
  team,
  assignments,
}: {
  team: LoadTeamResponse;
  assignments: FlightAssignmentResponse[];
}) {
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
              {assignments.length > 0 && (
                <>
                  {" · "}
                  <span className="font-semibold text-foreground">
                    {assignments.length} assigned
                  </span>
                </>
              )}
            </div>
            {team.notes && (
              <p className="mt-1 text-[0.7rem] text-muted-foreground/80">
                {team.notes}
              </p>
            )}
            {assignments.length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-border pt-2">
                {assignments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 text-[0.75rem]"
                  >
                    <Link
                      href={`/dispatch/${a.flight.id}`}
                      className="min-w-0 truncate hover:underline"
                    >
                      <span className="font-mono font-semibold text-foreground">
                        {a.flight.flight_number}
                      </span>
                      <span className="ml-1.5 text-muted-foreground">
                        {a.flight.origin} → {a.flight.destination}
                      </span>
                    </Link>
                    <span className="shrink-0 text-[0.7rem] text-muted-foreground">
                      {formatTime(a.flight.scheduled_departure_at)}
                    </span>
                  </li>
                ))}
              </ul>
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
