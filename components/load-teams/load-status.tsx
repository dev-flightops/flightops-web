import { StatusMark, type StatusTone } from "@/components/ff/status-mark";
import type { FlightAssignmentResponse } from "@/lib/api/types";
import { localClock } from "@/lib/format/local-time";

import { LoadTimer } from "./load-timer";

/**
 * Where a flight's load stands (#134), the client's loop: the team
 * acknowledges the load in the app so it's time-stamped, starts loading
 * it (LOG-43), photographs it and marks it complete; the pilot and
 * dispatch see "Load complete" beside fuel and the passengers. The load
 * is timed against the departure: the ramp timer.
 */
export type LoadStage = "assigned" | "acknowledged" | "loading" | "complete";

export function loadStage(a: FlightAssignmentResponse): LoadStage {
  if (a.load_completed_at) return "complete";
  if (a.load_started_at) return "loading";
  if (a.acknowledged_at) return "acknowledged";
  return "assigned";
}

const STAGE: Record<LoadStage, { label: string; tone: StatusTone }> = {
  assigned: { label: "Not acknowledged", tone: "yellow" },
  acknowledged: { label: "Acknowledged", tone: "blue" },
  loading: { label: "Loading", tone: "blue" },
  complete: { label: "Load complete", tone: "green" },
};

/** When this stage was reached, by whom, and the word before the time. */
function stamp(a: FlightAssignmentResponse, stage: LoadStage) {
  if (stage === "complete") return { at: a.load_completed_at, by: a.load_completed_by, word: "" };
  if (stage === "loading") return { at: a.load_started_at, by: a.load_started_by, word: "started " };
  if (stage === "acknowledged") return { at: a.acknowledged_at, by: a.acknowledged_by, word: "acknowledged " };
  return { at: null, by: null, word: "" };
}

function photos(n: number | undefined): string | null {
  if (!n) return null;
  return n === 1 ? "1 photo" : `${n} photos`;
}

/** "LOAD COMPLETE · 02:58 AKST by Nina Brightwater · 1 photo · Loaded in
 *  12 min, 20 min before departure". */
export function LoadStatusLine({
  assignment,
  timeZone,
  className,
}: {
  assignment: FlightAssignmentResponse;
  timeZone: string;
  className?: string;
}) {
  const stage = loadStage(assignment);
  const { label, tone } = STAGE[stage];
  const { at, by, word } = stamp(assignment, stage);
  const parts = [
    at ? `${word}${localClock(at, timeZone)}` : null,
    by ? `by ${by.full_name}` : null,
    stage === "assigned" ? assignment.load_team.team_name : null,
    photos(assignment.photo_count),
  ].filter(Boolean);
  // A flight closed without a load done has nothing left to time.
  const closed = assignment.flight.status === "completed" || assignment.flight.status === "cancelled";
  const timed = stage === "complete" || !closed;
  return (
    <span className={className}>
      <StatusMark label={label} tone={tone} />
      {(parts.length > 0 || timed) && (
        <>
          {" "}
          <span className="ml-1 text-xs text-muted-foreground">
            {parts.join(" · ")}
            {timed && (
              <>
                {parts.length > 0 ? " · " : ""}
                <LoadTimer
                  departsAt={assignment.flight.scheduled_departure_at}
                  startedAt={assignment.load_started_at ?? null}
                  completedAt={assignment.load_completed_at ?? null}
                  renderedAt={Date.now()}
                />
              </>
            )}
          </span>
        </>
      )}
    </span>
  );
}
