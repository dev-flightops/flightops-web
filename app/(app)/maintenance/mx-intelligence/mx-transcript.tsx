"use client";

import type { MxAnswer } from "@/lib/api/ai";

/**
 * The MX Intelligence conversation.
 *
 * Presentational half, split from mx-chat.tsx for the same reason
 * FleetBrain is split: the stateful half imports a server action,
 * which pulls next-auth then next/server and does not resolve under
 * vitest.
 *
 * Matched from legacy `templates/maintenance/mx_intelligence.html`.
 * Legacy renders each answer by assigning the model's text to
 * `innerHTML`, which makes any markup the model emits live in the
 * page. Ours is a text node with `whitespace-pre-line`, which is the
 * convention the rest of this app uses for model prose and the reason
 * the service prompt asks for plain text rather than markdown.
 */

export interface MxTurn {
  id: number;
  prompt: string;
  /** The tail the question was scoped to, if any. */
  tail: string | null;
  at: string;
  /** Absent while the answer is in flight. */
  reply?: MxAnswer;
  error?: string;
}

/** What the model was shown, in a line a mechanic can read.
 *
 *  This exists because the answer is only as good as its evidence, and
 *  the two failure modes are invisible otherwise: a truncated squawk
 *  list reads as the whole history, and a fleet with nothing grounded
 *  reads the same as a fleet whose grounded aircraft were filtered
 *  out — which is exactly what legacy does. */
export function ContextLine({ reply }: { reply: MxAnswer }) {
  const c = reply.context;
  const omitted: string[] = [];
  if (c.squawks_omitted > 0) omitted.push(`${c.squawks_omitted} older squawks`);
  if (c.work_orders_omitted > 0) {
    omitted.push(`${c.work_orders_omitted} more work orders`);
  }
  if (c.mel_items_omitted > 0) {
    omitted.push(`${c.mel_items_omitted} more MEL items`);
  }

  return (
    <div className="mt-2 border-t border-border pt-2 text-[0.65rem] text-muted-foreground">
      <p>
        Read {c.aircraft} aircraft
        {c.aircraft_grounded > 0 && (
          <>
            {" "}
            (
            <span className="text-status-red">
              {c.aircraft_grounded} grounded
            </span>
            )
          </>
        )}
        , {c.squawks_shown} squawk{c.squawks_shown === 1 ? "" : "s"},{" "}
        {c.work_orders_shown} open work order
        {c.work_orders_shown === 1 ? "" : "s"}, {c.mel_items_shown} open MEL
        item{c.mel_items_shown === 1 ? "" : "s"}.
      </p>
      {omitted.length > 0 && (
        <p className="mt-0.5 text-status-yellow">
          Not read: {omitted.join(", ")}. Ask about a single tail to narrow it.
        </p>
      )}
    </div>
  );
}

export function MxTranscript({
  turns,
  pending,
  examples,
  onExample,
}: {
  turns: MxTurn[];
  pending: boolean;
  examples: string[];
  onExample: (text: string) => void;
}) {
  if (turns.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 px-5 py-10 text-center">
        <p className="text-sm font-semibold text-foreground">
          Ask about a squawk, a recurring defect, or an aircraft that is down.
        </p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          Answers are grounded in this operator&rsquo;s own squawks, work
          orders and MEL items. It has no access to your maintenance manuals,
          airworthiness directives or service bulletins, and will say so
          rather than guess.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {examples.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onExample(e)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:border-status-blue"
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <ol className="space-y-4">
      {turns.map((turn) => (
        <li key={turn.id} className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">
              {turn.prompt}
            </p>
            <span className="shrink-0 font-mono text-[0.65rem] text-muted-foreground">
              {turn.at}
            </span>
          </div>
          {turn.tail && (
            <p className="font-mono text-[0.65rem] uppercase tracking-wider text-status-blue">
              scoped to {turn.tail}
            </p>
          )}

          {turn.error ? (
            <p
              role="alert"
              className="rounded-md border border-status-red/30 bg-status-red/10 px-3 py-2 text-sm text-status-red"
            >
              {turn.error}
            </p>
          ) : turn.reply ? (
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              {/* A text node, not innerHTML. Legacy assigns the model's
                  output to innerHTML, which puts whatever markup it
                  emits into the page. */}
              <p className="whitespace-pre-line text-sm text-foreground">
                {turn.reply.answer}
              </p>
              <ContextLine reply={turn.reply} />
              <p className="mt-2 text-[0.65rem] text-muted-foreground">
                {turn.reply.advisory}
              </p>
            </div>
          ) : (
            <p
              role="status"
              className="rounded-lg border border-border bg-card/40 px-4 py-3 text-sm text-muted-foreground"
            >
              Reading the maintenance records…
            </p>
          )}
        </li>
      ))}
      {pending && <li aria-hidden className="h-1" />}
    </ol>
  );
}
