"use client";

import type { FleetBrainReply } from "@/lib/api/ai";

/**
 * The FleetBrain conversation, laid out to follow legacy's
 * /fleetbrain/.
 *
 * Legacy is an HTMX page: the form posts and the server returns a
 * rendered partial that gets appended to a #responses div. Ours holds
 * the transcript in React state instead, which is the same shape
 * without a round trip per render.
 *
 * Matched from `templates/fleetbrain/chat.html` and
 * `partials/response.html` rather than from the running page — legacy's
 * demo account is read-only, so POST /fleetbrain/query answers 403 and
 * no answer ever renders there to photograph.
 *
 * Presentational half, split from fleetbrain-chat.tsx so it renders
 * under vitest: the stateful half imports a server action, which pulls
 * next-auth -> next/server and does not resolve there.
 */

export interface Turn {
  id: number;
  query: string;
  at: string;
  /** Absent while the answer is still in flight. */
  reply?: FleetBrainReply;
  error?: string;
}

/**
 * The service names its own colours; this maps them onto the palette
 * the app actually defines.
 *
 * Not a pass-through, and the difference bit: the service says "amber"
 * and this app's token is `status-yellow`. Writing `text-status-amber`
 * emits no class at all — Tailwind has nothing to generate — so the
 * badge rendered unstyled and nothing failed. Caught by looking at the
 * page, not by the tests, which only exercised red and green.
 * badge-palette.test.ts now checks every one of these against the
 * config.
 */
export const BADGE_CLASS: Record<string, string> = {
  green: "border-status-green/40 bg-status-green/10 text-status-green",
  amber: "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
  red: "border-status-red/40 bg-status-red/10 text-status-red",
  blue: "border-status-blue/40 bg-status-blue/10 text-status-blue",
  grey: "border-border bg-muted/20 text-muted-foreground",
};

/** Values legacy colour-codes inside the table. Kept to the ones that
 *  mean something operationally — an overdue inspection and a grounded
 *  aircraft are the cells a dispatcher is scanning for. */
export const CELL_TONE: Record<string, string> = {
  Overdue: "text-status-red font-semibold",
  Grounded: "text-status-red font-semibold",
  "Not current": "text-status-red font-semibold",
  grounding: "text-status-red font-semibold",
  expired: "text-status-red font-semibold",
  Grace: "text-status-yellow font-semibold",
  deferred: "text-status-yellow",
  released: "text-status-green",
  Legal: "text-status-green",
  Active: "text-status-green",
  cancelled: "text-muted-foreground line-through",
};

export function BrainMark({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="flex flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-status-blue to-status-purple"
    >
      <svg
        width={size * 0.5}
        height={size * 0.5}
        viewBox="0 0 24 24"
        fill="white"
      >
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
      </svg>
    </span>
  );
}

export function SuggestionButton({
  label,
  onPick,
  block = false,
}: {
  label: string;
  onPick: (q: string) => void;
  block?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(label)}
      className={
        "rounded-lg border border-status-blue/20 bg-status-blue/5 px-3 py-1.5 " +
        "text-xs text-status-blue transition-colors hover:bg-status-blue/12 " +
        (block ? "block w-full text-left" : "")
      }
    >
      {label}
    </button>
  );
}

export function FleetBrainTranscript({
  turns,
  examples,
  onPick,
}: {
  turns: Turn[];
  examples: string[];
  onPick: (q: string) => void;
}) {
  return (
    <div className="flex-1 space-y-4 overflow-y-auto">
      {/* Welcome, as legacy has it: the suggestions are the interface.
          A free-text box with no hints is a poor front end for a
          classifier that knows twelve things. */}
      <div className="flex gap-3">
        <BrainMark />
        <div className="max-w-xl rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-sm">
            I can answer questions about your operation in real time. Try
            asking:
          </p>
          <div className="mt-2 space-y-1">
            {examples.map((q) => (
              <SuggestionButton key={q} label={q} onPick={onPick} block />
            ))}
          </div>
        </div>
      </div>

      {turns.map((turn) => (
        <TurnBlock key={turn.id} turn={turn} onPick={onPick} />
      ))}
    </div>
  );
}

function TurnBlock({
  turn,
  onPick,
}: {
  turn: Turn;
  onPick: (q: string) => void;
}) {
  return (
    <div>
      {/* Asked */}
      <div className="mb-3 flex justify-end gap-3">
        <div className="max-w-lg rounded-xl bg-status-blue/12 px-4 py-2">
          <p className="text-sm">{turn.query}</p>
          <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
            {turn.at}
          </p>
        </div>
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted/30 text-[0.6rem] font-bold text-muted-foreground">
          You
        </span>
      </div>

      {/* Answered */}
      <div className="mb-4 flex gap-3">
        <BrainMark />
        <div className="min-w-0 flex-1">
          {turn.error ? (
            <p
              role="alert"
              className="rounded-xl border border-status-red/40 bg-status-red/10 px-4 py-3 text-sm text-status-red"
            >
              {turn.error}
            </p>
          ) : !turn.reply ? (
            <p className="px-1 text-sm text-muted-foreground">Thinking…</p>
          ) : (
            <Answer reply={turn.reply} at={turn.at} onPick={onPick} />
          )}
        </div>
      </div>
    </div>
  );
}

function Answer({
  reply,
  at,
  onPick,
}: {
  reply: FleetBrainReply;
  at: string;
  onPick: (q: string) => void;
}) {
  const { answer, intent } = reply;

  return (
    <>
      {answer.badges.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {answer.badges.map((b) => (
            <span
              key={b.text}
              className={
                "rounded border px-2 py-0.5 text-[0.65rem] font-semibold " +
                (BADGE_CLASS[b.color] ?? BADGE_CLASS.grey)
              }
            >
              {b.text}
            </span>
          ))}
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <p className="whitespace-pre-line text-sm">{answer.summary}</p>
      </div>

      {answer.rows.length > 0 ? (
        // Its own scroller: a nine-column answer must not push the
        // page sideways.
        <div className="mt-2 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                {answer.columns.map((col) => (
                  <th
                    key={col}
                    scope="col"
                    className="whitespace-nowrap px-3 py-2 font-semibold"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {answer.rows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-border/50 last:border-0"
                >
                  {answer.columns.map((col) => {
                    const value = row[col];
                    const text = value == null ? "" : String(value);
                    return (
                      <td
                        key={col}
                        className={
                          "px-3 py-1.5 " + (CELL_TONE[text] ?? "")
                        }
                      >
                        {text}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {answer.suggestions.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {answer.suggestions.map((s) => (
            <SuggestionButton key={s} label={s} onPick={onPick} />
          ))}
        </div>
      ) : null}

      {/* What it understood. Legacy shows the same line, and it is the
          only thing that makes a wrong answer diagnosable without
          reading the server log. */}
      <p className="mt-1.5 text-[0.65rem] text-muted-foreground/60">
        {answer.unsupported
          ? "not tracked here"
          : `intent: ${intent.intent_type}`}
        {intent.confidence > 0
          ? ` (${Math.round(intent.confidence * 100)}%)`
          : ""}{" "}
        · {at}
      </p>
    </>
  );
}
