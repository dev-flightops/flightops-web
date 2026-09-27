"use client";

import { useState, useTransition } from "react";

import {
  assignFlightAction,
  unassignFlightAction,
  type AssignActionState,
} from "@/components/load-teams/assign-actions";
import { Spinner } from "@/components/ui/spinner";

export interface LoadTeamCard {
  id: string;
  name: string;
  /** The team's own colour, as on /ramp-ops and Settings → Load Teams. */
  color: string;
  /** "Lead · 4 members", or why there's no such line. */
  detail: string;
  assigned: boolean;
}

const CARD =
  "flex min-w-[10rem] items-start gap-2 rounded-lg border px-3 py-2 text-left";

/**
 * The Load Team panel's cards. Clicking a team assigns it; the assigned
 * team is marked rather than clickable, and Clear takes it off. See
 * LoadTeamPanel for what the cards hold and why.
 */
export function LoadTeamPicker({
  flightId,
  flightNumber,
  cards,
  lockedNote,
}: {
  flightId: string;
  flightNumber: string;
  cards: LoadTeamCard[];
  /** Set when the flight can no longer change team; the cards then
   *  only show who had it. */
  lockedNote: string | null;
}) {
  const [pending, startTransition] = useTransition();
  // One error for both actions, so it always belongs to the last thing
  // the dispatcher tried.
  const [error, setError] = useState<string | null>(null);
  const assigned = cards.find((c) => c.assigned) ?? null;
  const editable = lockedNote === null;

  // Called directly rather than as form actions, like CrewPanel: the
  // unit tests run React 18, which has neither useActionState nor
  // function form actions. The actions revalidate /dispatch, which
  // re-renders the panel with the new assignment.
  function run(teamId: string | null) {
    const formData = new FormData();
    formData.set("flight_id", flightId);
    if (teamId) formData.set("load_team_id", teamId);
    setError(null);
    startTransition(async () => {
      const idle: AssignActionState = { status: "idle" };
      const result = teamId
        ? await assignFlightAction(idle, formData)
        : await unassignFlightAction(idle, formData);
      if (result.status === "error") setError(result.message);
    });
  }

  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-2">
        {cards.map((card) => (
          <li key={card.id}>
            {card.assigned || !editable ? (
              <div
                className={`${CARD} ${
                  card.assigned
                    ? "border-primary/40 bg-primary/10"
                    : "border-border bg-card"
                }`}
              >
                <CardBody card={card} />
                {card.assigned && (
                  <span className="ml-auto pl-2 text-[0.6rem] font-bold uppercase tracking-[0.06em] text-primary">
                    Assigned
                  </span>
                )}
              </div>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(card.id)}
                className={`${CARD} border-border bg-card transition-colors hover:bg-accent focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-60`}
              >
                <span className="sr-only">Assign </span>
                <CardBody card={card} />
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="flex min-h-7 flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        {pending ? (
          <span className="flex items-center gap-2">
            <Spinner size="xs" />
            Updating load team…
          </span>
        ) : lockedNote ? (
          <span>{lockedNote}</span>
        ) : assigned ? (
          <span>
            {flightNumber} is assigned to{" "}
            <span className="font-semibold text-foreground">
              {assigned.name}
            </span>
            .
          </span>
        ) : (
          <span>Not assigned — pick the team that loads {flightNumber}.</span>
        )}
        {editable && assigned && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(null)}
            className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:border-status-red/40 hover:text-status-red disabled:opacity-50"
          >
            Clear
            <span className="sr-only"> load team {assigned.name}</span>
          </button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-status-red/30 bg-status-red/5 px-3 py-2 text-xs text-status-red"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function CardBody({ card }: { card: LoadTeamCard }) {
  return (
    <>
      <span
        aria-hidden
        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: card.color }}
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">
          {card.name}
        </span>
        <span className="block text-[0.68rem] text-muted-foreground">
          {card.detail}
        </span>
      </span>
    </>
  );
}
