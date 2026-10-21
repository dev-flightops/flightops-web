import Link from "next/link";

import { tab, tabList } from "@/components/ff/controls";
import { listStaff } from "@/lib/api/auth";
import { formatRole } from "@/lib/roles";
import { listLoadTeams, listStations } from "@/lib/api/ground";
import { ApiError } from "@/lib/api/client";
import type { LoadTeamResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { MembersSheet } from "./members-sheet";
import { TeamActiveButton } from "./team-active-button";
import {
  TeamDialog,
  type PersonOption,
  type StationOption,
} from "./team-dialog";

/**
 * /settings/load-teams — legacy `templates/settings/load_teams.html`.
 *
 * Teams from ground-service `/load-teams`, grouped by base as legacy
 * does, each base headed with its station name. Add Team, Edit,
 * Members and Deactivate / Reactivate work against the same service;
 * the lead and member pickers use the staff directory, which any staff
 * member can read (#60), and say so when it can't be loaded.
 *
 * Not built, and shown as such: Fleet Report and each team's
 * Performance page (legacy reports on turnaround timings we don't
 * record), and the Reminders and Activity Log tabs (legacy's automated
 * reminder texts — nothing here sends them).
 */

const NOT_BUILT = "Not built yet";

type StatusParam = "active" | "all";

function parseStatus(v: string | string[] | undefined): StatusParam {
  const s = Array.isArray(v) ? v[0] : v;
  if (s === "all") return "all";
  return "active";
}

export const dynamic = "force-dynamic";

export default async function SettingsLoadTeamsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const statusFilter = parseStatus(params.status);

  const [teamsResult, stationsResult, peopleResult] = await Promise.allSettled([
    listLoadTeams({ includeInactive: statusFilter === "all" }),
    listStations({ limit: 500 }),
    // The staff directory (#60), which any staff member may read. Until
    // #60 this was the Exec Admin's user list, so a DO had no pickers.
    listStaff(),
  ]);

  let teams: LoadTeamResponse[] = [];
  let loadError: string | null = null;
  if (teamsResult.status === "fulfilled") {
    teams = teamsResult.value.items;
  } else {
    const err = teamsResult.reason;
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : status === 403
          ? "You don't have permission to manage load teams."
          : "Load teams unavailable. Try refreshing in a moment.";
  }

  // Soft-fail: without stations the base picker offers only the bases
  // teams already use, and headings show the code alone.
  const stations: StationOption[] =
    stationsResult.status === "fulfilled"
      ? stationsResult.value.items
          .filter((s) => s.is_active)
          .map((s) => ({ icao: s.icao_code, name: s.name }))
          .sort((a, b) => a.icao.localeCompare(b.icao))
      : [];
  const stationNames = new Map(stations.map((s) => [s.icao, s.name]));

  // Null, not empty, when the staff list can't be read: the pickers
  // then explain who can set a lead or add a member.
  let people: PersonOption[] | null = null;
  if (peopleResult.status === "fulfilled") {
    people = peopleResult.value.items
      .map((u) => ({
        id: u.id,
        name: u.full_name,
        roles: u.roles.map(formatRole).join(", "),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const grouped = groupByBase(teams);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <nav aria-label="Breadcrumb" className="eyebrow mb-4 flex flex-wrap items-center">
        <Link href="/settings" className="hover:text-foreground">
          Settings
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">/</span>
        <span className="text-foreground">Load Teams</span>
      </nav>

      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="page-title">Load Teams</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Manage ramp and load crew teams by base
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NotBuilt className="btn-caps rounded-md border border-input px-3 py-2 text-foreground">
            Fleet Report
          </NotBuilt>
          <TeamDialog
            stations={stations}
            people={people}
            trigger="+ Add Team"
            triggerClassName="btn-caps rounded-md bg-primary px-3 py-2 text-primary-foreground hover:bg-brand-dark"
          />
          <Link
            href={
              statusFilter === "all"
                ? "/settings/load-teams"
                : "/settings/load-teams?status=all"
            }
            className="btn-caps rounded-md border border-input px-3 py-2 text-foreground hover:bg-accent"
          >
            {statusFilter === "all" ? "Hide Inactive" : "Show Inactive"}
          </Link>
        </div>
      </header>

      <div className={cn(tabList, "mb-6")}>
        <span className={tab(true)}>Teams</span>
        <NotBuilt className={tab(false)}>Reminders</NotBuilt>
        <NotBuilt className={tab(false)}>Activity Log</NotBuilt>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="notice notice-yellow"
        >
          {loadError}
        </div>
      ) : teams.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {statusFilter === "all"
              ? "No load teams yet."
              : "No active load teams. Show Inactive lists archived ones."}
          </p>
          <div className="mt-2">
            <TeamDialog
              stations={stations}
              people={people}
              trigger="Create a team"
              triggerClassName="text-sm font-semibold text-primary hover:underline"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([base, list]) => (
            <BaseSection
              key={base}
              base={base}
              stationName={stationNames.get(base) ?? null}
              teams={list}
              stations={stations}
              people={people}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function groupByBase(
  teams: LoadTeamResponse[],
): Record<string, LoadTeamResponse[]> {
  const grouped: Record<string, LoadTeamResponse[]> = {};
  for (const t of teams) {
    (grouped[t.base_icao] ??= []).push(t);
  }
  return grouped;
}

/** A legacy control with nothing behind it yet: dimmed, "Not built yet"
 *  on hover, as the maintenance header marks its unbuilt actions. */
function NotBuilt({
  className,
  children,
}: {
  className: string;
  children: string;
}) {
  return (
    <span
      role="button"
      aria-disabled="true"
      title={NOT_BUILT}
      className={`cursor-not-allowed opacity-50 ${className}`}
    >
      {children}
    </span>
  );
}

function BaseSection({
  base,
  stationName,
  teams,
  stations,
  people,
}: {
  base: string;
  stationName: string | null;
  teams: LoadTeamResponse[];
  stations: StationOption[];
  people: PersonOption[] | null;
}) {
  return (
    <section aria-label={`${base} load teams`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <h2 className="panel-title">
          {stationName ? `${base} — ${stationName}` : base}
        </h2>
        <div className="flex items-center gap-3">
          <span className="eyebrow">
            {teams.length} team{teams.length === 1 ? "" : "s"}
          </span>
          <TeamDialog
            defaultBase={base}
            stations={stations}
            people={people}
            trigger={`+ Add Team at ${base}`}
            triggerClassName="btn-caps rounded border border-input px-2.5 py-1 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary text-[0.68rem]"
          />
        </div>
      </div>
      {/* The base's teams as one table (#86), not a grid of cards. */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="ff-thead">
            <tr>
              {/* Shared widths, so the bases' tables line up down the page. */}
              <th scope="col" className="w-[30%] px-4 py-2">Team</th>
              <th scope="col" className="w-[22%] px-4 py-2">Lead</th>
              <th scope="col" className="w-[10%] px-4 py-2 text-right">Members</th>
              <th scope="col" className="w-[12%] px-4 py-2">Status</th>
              <th scope="col" className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <TeamRow key={t.id} team={t} stations={stations} people={people} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const CARD_BUTTON =
  "btn-caps rounded border border-input px-2.5 py-1 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary text-[0.68rem]";

function TeamRow({
  team,
  stations,
  people,
}: {
  team: LoadTeamResponse;
  stations: StationOption[];
  people: PersonOption[] | null;
}) {
  return (
    <tr className="border-b border-border align-top last:border-b-0 hover:bg-accent">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {/* The team's own colour, as a swatch: a data colour is never text. */}
          <span
            className="h-3 w-3 flex-shrink-0 rounded-sm"
            style={{ background: team.color_code }}
            aria-hidden
          />
          <span className="font-semibold text-foreground">{team.team_name}</span>
        </div>
        {team.notes && (
          <p className="mt-1 text-[0.7rem] text-muted-foreground">{team.notes}</p>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        {team.team_lead ? (
          team.team_lead.full_name
        ) : (
          <span className="text-status-yellow">No Lead Assigned</span>
        )}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">{team.member_count}</td>
      <td className="px-4 py-3">
        <span
          className={
            "status-mark " + (team.is_active ? "text-status-green" : "text-status-red")
          }
        >
          {team.is_active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap justify-end gap-1">
          <TeamDialog
            team={team}
            stations={stations}
            people={people}
            trigger="Edit"
            triggerLabel={`Edit ${team.team_name}`}
            triggerClassName={CARD_BUTTON}
          />
          <MembersSheet team={team} people={people} />
          <NotBuilt className={CARD_BUTTON}>Performance</NotBuilt>
          <TeamActiveButton
            teamId={team.id}
            teamName={team.team_name}
            active={team.is_active}
          />
        </div>
      </td>
    </tr>
  );
}
