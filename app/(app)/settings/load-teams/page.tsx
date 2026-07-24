import Link from "next/link";

import { listLoadTeams } from "@/lib/api/ground";
import { ApiError } from "@/lib/api/client";
import type { LoadTeamResponse } from "@/lib/api/types";

/**
 * /settings/load-teams — legacy `templates/settings/load_teams.html`.
 *
 * Reads live from `/ground/load-teams` (endpoints already existed
 * from an earlier M2 story). Teams are grouped by base ICAO into
 * per-base sections mirroring legacy. Each team card shows a
 * colour swatch, lead assignment (green name or amber "No Lead
 * Assigned"), member count, and notes.
 *
 * Add-team / Edit / Members / Performance modals are still to
 * come — the backend endpoints exist (POST /ground/load-teams,
 * PATCH /ground/load-teams/{id}, /members etc.); the modal UI
 * wiring is a follow-up story.
 */

const BACKEND_HINT_EDIT =
  "Add / Edit modals are a follow-up — backend endpoints are live";

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

  let teams: LoadTeamResponse[] = [];
  let loadError: string | null = null;
  try {
    const response = await listLoadTeams({
      includeInactive: statusFilter === "all",
    });
    teams = response.items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : status === 403
          ? "You don't have permission to manage load teams."
          : "Load teams unavailable. Try refreshing in a moment.";
  }

  const grouped = groupByBase(teams);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs">
        <Link href="/settings" className="text-muted-foreground hover:text-foreground">
          Settings
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">/</span>
        <span className="font-semibold text-status-blue">Load Teams</span>
      </nav>

      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Load Teams</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Manage ramp and load crew teams by base
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={BACKEND_HINT_EDIT}
            className="cursor-not-allowed rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-100"
          >
            Fleet Report
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={BACKEND_HINT_EDIT}
            className="cursor-not-allowed rounded-md bg-status-blue px-3 py-2 text-sm font-semibold text-white disabled:opacity-100"
          >
            + Add Team
          </button>
          <Link
            href={
              statusFilter === "all"
                ? "/settings/load-teams"
                : "/settings/load-teams?status=all"
            }
            className="rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted/30"
          >
            {statusFilter === "all" ? "Hide Inactive" : "Show Inactive"}
          </Link>
        </div>
      </header>

      <div className="mb-4 flex gap-1 border-b-2 border-border">
        <TabChip label="Teams" active />
        <TabChip label="Reminders" />
        <TabChip label="Activity Log" />
      </div>

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      ) : teams.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-6 py-10 text-center">
          <div className="mx-auto mb-2 text-2xl opacity-30">👥</div>
          <p className="text-sm text-muted-foreground">
            {statusFilter === "all"
              ? "No load teams — active or inactive."
              : "No active load teams. Toggle Show Inactive to see archived teams, or Add Team to create one."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([base, list]) => (
            <BaseSection key={base} base={base} teams={list} />
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

function BaseSection({
  base,
  teams,
}: {
  base: string;
  teams: LoadTeamResponse[];
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
        <span className="text-sm font-bold uppercase tracking-[0.04em] text-status-blue">
          {base}
        </span>
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {teams.length} team{teams.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {teams.map((t) => (
          <TeamCard key={t.id} team={t} />
        ))}
      </div>
    </section>
  );
}

function TeamCard({ team }: { team: LoadTeamResponse }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card p-3 pl-4 transition-colors hover:border-status-blue/30">
      <span
        className="absolute left-0 top-0 bottom-0 w-1.5"
        style={{ background: team.color_code }}
        aria-hidden
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold">{team.team_name}</span>
        <span
          className={
            "rounded px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.03em] " +
            (team.is_active
              ? "border border-status-green/30 bg-status-green/10 text-status-green"
              : "border border-status-red/30 bg-status-red/10 text-status-red")
          }
        >
          {team.is_active ? "Active" : "Inactive"}
        </span>
      </div>
      <div className="mt-1 text-xs">
        Lead:{" "}
        {team.team_lead ? (
          <span className="font-semibold text-status-green">
            {team.team_lead.full_name}
          </span>
        ) : (
          <span className="italic text-status-yellow">No Lead Assigned</span>
        )}
      </div>
      <div className="mt-1 text-[0.72rem] text-muted-foreground">
        <strong className="text-foreground">{team.member_count}</strong>{" "}
        member{team.member_count === 1 ? "" : "s"} · {team.base_icao}
      </div>
      {team.notes && (
        <p className="mt-1 text-[0.65rem] text-muted-foreground">
          {team.notes}
        </p>
      )}
      <div className="mt-2 flex gap-1">
        {(["Edit", "Members", "Performance"] as const).map((label) => (
          <button
            key={label}
            type="button"
            disabled
            aria-disabled="true"
            title={BACKEND_HINT_EDIT}
            className="cursor-not-allowed rounded border border-border bg-transparent px-2.5 py-1 text-[0.65rem] font-semibold text-muted-foreground disabled:opacity-100"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TabChip({ label, active }: { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      aria-pressed={active}
      title="Reminders + Activity Log tabs are a follow-up story"
      className={
        "-mb-0.5 cursor-not-allowed px-4 py-2 text-xs font-semibold disabled:opacity-100 " +
        (active
          ? "border-b-2 border-status-blue text-status-blue"
          : "border-b-2 border-transparent text-muted-foreground")
      }
    >
      {label}
    </button>
  );
}
