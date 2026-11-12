import { CheckGlyph } from "@/components/ff/glyphs";
import type { FlightProgressResponse, HandoffTurn } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const TURN: Record<HandoffTurn, string> = {
  dispatch: "dispatch",
  pilot: "the pilot",
  chief_pilot_or_do: "the Chief Pilot or DO",
};

/** "Next: FRAT signed by dispatch." A step that already names who does it
 *  isn't followed by them again (it read "…by dispatch, dispatch."); one
 *  that doesn't says whose turn it is. */
function nextLine(next: NonNullable<FlightProgressResponse["next"]>): string {
  const who = next.turn ? TURN[next.turn] : null;
  if (!who || next.label.toLowerCase().includes(`by ${who.toLowerCase()}`)) return `Next: ${next.label}.`;
  return `Next: ${next.label}, ${who}'s turn.`;
}

function time(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  });
}

/**
 * Where a flight is, from built to logged, and whose turn it is (#175): the
 * client's "track the process". The steps come from ops
 * (GET /ops/flights/{id}/progress), the same that make Waiting on you.
 */
export function FlightProgress({
  progress,
  timeZone,
}: {
  progress: FlightProgressResponse;
  timeZone: string;
}) {
  const next = progress.next;
  return (
    <section aria-label="Flight progress" className="rounded-lg border border-border bg-card px-5 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="eyebrow">Progress</p>
        <p className="text-xs text-foreground">
          {progress.status === "cancelled"
            ? "Cancelled."
            : next
              ? nextLine(next)
              : "Every step is done."}
        </p>
      </div>
      <ol className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {progress.steps.map((step) => {
          const current = next !== null && step.key === next.key;
          return (
            <li
              key={step.key}
              className={cn(
                "inline-flex items-center gap-1.5",
                step.state === "done"
                  ? "text-foreground"
                  : current
                    ? "font-semibold text-status-yellow"
                    : "text-muted-foreground",
              )}
              aria-current={current ? "step" : undefined}
            >
              {step.state === "done" ? (
                <CheckGlyph size={12} className="shrink-0 text-status-green" />
              ) : (
                <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0", current ? "bg-current" : "bg-border")} />
              )}
              <span>
                {step.label}
                {step.state === "skipped" ? " (not on record)" : null}
                {step.state === "done" && (step.by_name || step.at) ? (
                  <span className="text-muted-foreground">
                    {` · ${[step.by_name, step.at ? time(step.at, timeZone) : null].filter(Boolean).join(", ")}`}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
      {next && next.notes.length > 0 ? (
        <ul className="mt-2 list-disc pl-5 text-xs text-foreground">
          {next.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** What the flight still needs before dispatch can sign its FRAT: the
 *  built step's notes while it isn't done. */
export function buildGaps(progress: FlightProgressResponse | null): string[] {
  const built = progress?.steps.find((s) => s.key === "built");
  return built && built.state === "todo" ? built.notes : [];
}
