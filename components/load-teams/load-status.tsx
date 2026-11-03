import { StatusMark, type StatusTone } from "@/components/ff/status-mark";
import type { FlightAssignmentResponse } from "@/lib/api/types";
import { localClock } from "@/lib/format/local-time";

/**
 * Where a flight's load stands (#134), the client's loop: the team
 * acknowledges the load in the app so it's time-stamped, loads it,
 * photographs it and marks it complete; the pilot and dispatch see
 * "Load complete" beside fuel and the passengers.
 */
export type LoadStage = "assigned" | "acknowledged" | "complete";

export function loadStage(a: FlightAssignmentResponse): LoadStage {
  if (a.load_completed_at) return "complete";
  if (a.acknowledged_at) return "acknowledged";
  return "assigned";
}

const STAGE: Record<LoadStage, { label: string; tone: StatusTone }> = {
  assigned: { label: "Not acknowledged", tone: "yellow" },
  acknowledged: { label: "Loading", tone: "blue" },
  complete: { label: "Load complete", tone: "green" },
};

function photos(n: number | undefined): string | null {
  if (!n) return null;
  return n === 1 ? "1 photo" : `${n} photos`;
}

/** "LOAD COMPLETE · 02:58 AKST by Nina Brightwater · 1 photo". */
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
  const at =
    stage === "complete"
      ? assignment.load_completed_at
      : stage === "acknowledged"
        ? assignment.acknowledged_at
        : null;
  const by =
    stage === "complete"
      ? assignment.load_completed_by?.full_name
      : stage === "acknowledged"
        ? assignment.acknowledged_by?.full_name
        : null;
  const parts = [
    at ? `${stage === "complete" ? "" : "acknowledged "}${localClock(at, timeZone)}` : null,
    by ? `by ${by}` : null,
    stage === "assigned" ? assignment.load_team.team_name : null,
    photos(assignment.photo_count),
  ].filter(Boolean);
  return (
    <span className={className}>
      <StatusMark label={label} tone={tone} />
      {parts.length > 0 && (
        <>
          {" "}
          <span className="ml-1 text-xs text-muted-foreground">{parts.join(" · ")}</span>
        </>
      )}
    </span>
  );
}
