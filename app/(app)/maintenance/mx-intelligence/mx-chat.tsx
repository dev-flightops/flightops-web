"use client";

import { useRef, useState } from "react";

import { askMxAction } from "./actions";
import { MxTranscript, type MxTurn } from "./mx-transcript";

/**
 * Stateful shell. Owns the transcript and the in-flight request;
 * everything visible lives in MxTranscript so it renders under vitest
 * without dragging the server action in.
 *
 * No conversation history goes to the model. Each question is answered
 * from the records alone, which is also what legacy does — its chat
 * posts one prompt and keeps nothing. Worth being explicit about
 * rather than leaving as an accident: threading history is a real
 * feature with a real cost, and pretending to have it is worse than
 * not having it. The transcript on screen is for the mechanic, not for
 * the model.
 */
export function MxChat({ examples }: { examples: string[] }) {
  const [turns, setTurns] = useState<MxTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [tail, setTail] = useState("");
  const [pending, setPending] = useState(false);
  const nextId = useRef(0);
  const foot = useRef<HTMLDivElement>(null);

  async function ask(prompt: string) {
    const text = prompt.trim();
    if (!text || pending) return;

    const id = nextId.current++;
    const scoped = tail.trim().toUpperCase() || null;
    const at = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    setTurns((t) => [...t, { id, prompt: text, tail: scoped, at }]);
    setDraft("");
    setPending(true);
    queueMicrotask(() =>
      foot.current?.scrollIntoView({ behavior: "smooth", block: "end" }),
    );

    const result = await askMxAction(text, scoped);

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
    <div className="space-y-4">
      <MxTranscript
        turns={turns}
        pending={pending}
        examples={examples}
        onExample={(text) => void ask(text)}
      />
      <div ref={foot} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(draft);
        }}
        className="sticky bottom-4 space-y-2 rounded-lg border border-border bg-card p-3"
      >
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={pending}
            placeholder="Describe the symptom, or ask about a tail"
            aria-label="Maintenance question"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-status-blue focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
          >
            {pending ? "Reading…" : "Ask"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor="mx-tail"
            className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Scope to tail
          </label>
          <input
            id="mx-tail"
            value={tail}
            onChange={(e) => setTail(e.target.value)}
            disabled={pending}
            placeholder="optional — e.g. N200PA"
            maxLength={12}
            className="w-40 rounded-md border border-border bg-background px-2 py-1 font-mono text-xs uppercase text-foreground placeholder:normal-case placeholder:font-sans placeholder:text-muted-foreground focus:border-status-blue focus:outline-none disabled:opacity-60"
          />
          <span className="text-[0.65rem] text-muted-foreground">
            Narrows the records read, so a question about one aircraft is not
            answered from the whole fleet.
          </span>
        </div>
      </form>
    </div>
  );
}
