"use client";

import { useRef, useState } from "react";

import { askAction } from "./actions";
import {
  BrainMark,
  FleetBrainTranscript,
  type Turn,
} from "./fleetbrain-transcript";

/**
 * Stateful shell. Owns the transcript and the in-flight request;
 * everything visible lives in FleetBrainTranscript so it renders under
 * vitest without dragging the server action in.
 */
export function FleetBrainChat({ examples }: { examples: string[] }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const nextId = useRef(0);
  const foot = useRef<HTMLDivElement>(null);

  async function ask(query: string) {
    const text = query.trim();
    if (!text || pending) return;

    const id = nextId.current++;
    // Local time, because the timestamp sits next to the dispatcher's
    // own question. The answer's dates come from the server, resolved
    // in the zone sent below.
    const at = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    setTurns((t) => [...t, { id, query: text, at }]);
    setDraft("");
    setPending(true);
    // Scroll after the question lands, not after the answer — the
    // dispatcher should see their own words go up immediately.
    queueMicrotask(() =>
      foot.current?.scrollIntoView({ behavior: "smooth", block: "end" }),
    );

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const result = await askAction(text, tz);

    setTurns((t) =>
      t.map((turn) =>
        turn.id === id
          ? result.ok
            ? { ...turn, reply: result.reply }
            : { ...turn, error: result.error }
          : turn,
      ),
    );
    setPending(false);
    queueMicrotask(() =>
      foot.current?.scrollIntoView({ behavior: "smooth", block: "end" }),
    );
  }

  return (
    <div
      className="mx-auto flex max-w-4xl flex-col px-4 py-6 sm:px-6"
      style={{ minHeight: "calc(100vh - 140px)" }}
    >
      <header className="mb-5 flex items-center gap-3">
        <BrainMark size={36} />
        <div>
          <h1 className="text-xl font-bold">FleetBrain</h1>
          <p className="text-xs text-muted-foreground">
            AI copilot — ask anything about your operation
          </p>
        </div>
      </header>

      <FleetBrainTranscript turns={turns} examples={examples} onPick={ask} />
      <div ref={foot} />

      <div className="sticky bottom-0 mt-4 bg-background pb-2 pt-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(draft);
          }}
          className="flex gap-2"
        >
          <label htmlFor="fleetbrain-query" className="sr-only">
            Ask FleetBrain
          </label>
          <input
            id="fleetbrain-query"
            name="query"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoComplete="off"
            maxLength={500}
            placeholder="Ask FleetBrain anything about your operation..."
            className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm focus:border-status-blue focus:outline-none"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="rounded-xl bg-status-blue px-5 py-2.5 text-white hover:brightness-110 disabled:opacity-40"
          >
            <span className="sr-only">{pending ? "Asking" : "Ask"}</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
        <p className="mt-1.5 text-center text-[0.65rem] text-muted-foreground/60">
          FleetBrain queries live platform data. Results reflect current state
          as of query time.
        </p>
      </div>
    </div>
  );
}
