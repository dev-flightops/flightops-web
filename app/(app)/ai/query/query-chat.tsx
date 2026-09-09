"use client";

import { useRef, useState } from "react";

import type { QueryEntity } from "@/lib/api/ai";

import { askQueryAction } from "./actions";
import { QueryView, type Turn } from "./query-view";

/**
 * Stateful shell. Everything visible lives in QueryView so the layout
 * renders under vitest without the server action dragging next/server
 * in behind it.
 */
export function QueryChat({ entities }: { entities: QueryEntity[] }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const nextId = useRef(0);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || pending) return;

    const id = nextId.current++;
    const at = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    // Newest first: the answer someone just asked for should not be
    // below a screenful of older ones.
    setTurns((t) => [{ id, question: text, at }, ...t]);
    setDraft("");
    setPending(true);

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const outcome = await askQueryAction(text, tz);

    setTurns((t) =>
      t.map((turn) =>
        turn.id === id
          ? outcome.ok
            ? { ...turn, result: outcome.result }
            : { ...turn, error: outcome.error }
          : turn,
      ),
    );
    setPending(false);
  }

  return (
    <QueryView
      turns={turns}
      draft={draft}
      pending={pending}
      entities={entities}
      onDraftChange={setDraft}
      onAsk={ask}
    />
  );
}
