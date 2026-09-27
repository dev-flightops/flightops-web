import { ApiError } from "@/lib/api/client";
import { getFlightAssignment, listLoadTeams } from "@/lib/api/ground";
import type {
  FlightAssignmentResponse,
  FlightDetail,
  LoadTeamResponse,
} from "@/lib/api/types";

import { LoadTeamPicker, type LoadTeamCard } from "./load-team-picker";
import { EmptyPanel, SectionPanel } from "./section-panel";

/**
 * Load Team — the ramp team that loads the selected flight. Legacy
 * `templates/dispatch/form.html` (markup 521-527, script 1445-1516):
 * a card per team at the departure base, click one to assign it, and
 * the current assignment named under them.
 *
 * It writes the same row as /ramp-ops' Assign team dropdown
 * (ground-service flight-assignments), through the same actions, so
 * the two pages can't disagree about who is loading a flight.
 *
 * Where it differs from legacy, on purpose:
 *   - The base is the flight's origin. Legacy took the first word of
 *     the route box, which is the origin until a dispatcher retypes the
 *     route; the team works where the aircraft is.
 *   - No flight, no cards. Legacy let you pick a team before the flight
 *     existed and held it until save. The packet only opens flights
 *     that already exist, so there is nothing to hold it for.
 *   - Cards show the member count. Legacy showed "checked in / total";
 *     load-team check-ins aren't recorded, and "0/4 in" would read as
 *     nobody having turned up.
 *   - The assignment can be cleared here. Legacy's packet could only
 *     reassign.
 *   - A cancelled or completed flight shows its team read-only, like
 *     the packet's other actions (see RightColumn).
 *   - With no teams at the base, legacy said "add teams in Settings",
 *     linking a dispatcher to a page its own access check bounced them
 *     from. Settings isn't in a dispatcher's navigation here either, so
 *     the panel just says there are none.
 */
export async function LoadTeamPanel({
  flight,
}: {
  flight: FlightDetail | null;
}) {
  if (!flight) {
    return (
      <EmptyPanel
        title="Load Team"
        hint="Pick a flight from the dropdown above to assign the team that loads it."
        accent="blue"
      />
    );
  }

  const base = flight.origin;
  let teams: LoadTeamResponse[];
  let assignment: FlightAssignmentResponse | null;
  try {
    // Every active team, not just this base's: a flight can be on a
    // team from elsewhere (/ramp-ops offers all teams when a base has
    // none), and its card should still name the lead.
    [{ items: teams }, assignment] = await Promise.all([
      listLoadTeams(),
      getFlightAssignment(flight.id),
    ]);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    return (
      <SectionPanel title="Load Team" accent="blue">
        <p
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          {status === 401
            ? "Session expired — sign in again to load teams."
            : "Load teams unavailable — try refreshing in a moment."}
        </p>
      </SectionPanel>
    );
  }

  const editable =
    flight.status === "scheduled" || flight.status === "released";
  const cards = buildCards({ teams, assignment, base, editable });

  return (
    <SectionPanel
      title="Load Team"
      accent="blue"
      titleAction={
        <span className="text-[0.68rem] text-muted-foreground">
          Teams at <span className="font-mono font-semibold">{base}</span>
        </span>
      }
    >
      {cards.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {editable
            ? `No load teams at ${base}.`
            : `No load team was assigned. This flight is ${flight.status}.`}
        </p>
      ) : (
        <LoadTeamPicker
          // A fresh picker per flight, so an error about one flight
          // isn't left showing on the next.
          key={flight.id}
          flightId={flight.id}
          flightNumber={flight.flight_number}
          cards={cards}
          lockedNote={
            editable
              ? null
              : `This flight is ${flight.status} — its load team can't be changed.`
          }
        />
      )}
    </SectionPanel>
  );
}

function buildCards({
  teams,
  assignment,
  base,
  editable,
}: {
  teams: LoadTeamResponse[];
  assignment: FlightAssignmentResponse | null;
  base: string;
  editable: boolean;
}): LoadTeamCard[] {
  const current = assignment?.load_team ?? null;
  const cards: LoadTeamCard[] = editable
    ? teams
        .filter((t) => t.base_icao === base)
        .map((t) => toCard(t, base, t.id === current?.id))
    : [];

  if (current && !cards.some((c) => c.id === current.id)) {
    const team = teams.find((t) => t.id === current.id);
    // Only active teams are listed, so a current team missing from the
    // list has been deactivated since it was assigned.
    cards.unshift(
      team
        ? toCard(team, base, true)
        : {
            id: current.id,
            name: current.team_name,
            color: current.color_code,
            detail:
              current.base_icao === base
                ? "Inactive team"
                : `Inactive team · based at ${current.base_icao}`,
            assigned: true,
          },
    );
  }
  return cards;
}

function toCard(
  team: LoadTeamResponse,
  base: string,
  assigned: boolean,
): LoadTeamCard {
  const parts = [
    team.team_lead?.full_name ?? "No lead",
    `${team.member_count} ${team.member_count === 1 ? "member" : "members"}`,
  ];
  if (team.base_icao !== base) parts.push(`based at ${team.base_icao}`);
  return {
    id: team.id,
    name: team.team_name,
    color: team.color_code,
    detail: parts.join(" · "),
    assigned,
  };
}
