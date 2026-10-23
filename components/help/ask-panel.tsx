"use client";

import { useEffect, useRef } from "react";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import { Notice } from "@/components/ff/notice";
import { RichText } from "@/components/help/rich-text";
import {
  MAX_QUESTION_CHARS,
  type HelpChat,
  type PageRef,
} from "@/components/help/use-help-chat";
import { cn } from "@/lib/utils";

/**
 * Ask, in the help panel (#114): a question in, an answer from
 * Peregrine's help content, with links to the pages and guides.
 *
 * The conversation itself lives in useHelpChat, held by the panel. This
 * renders it, with the box to ask in and a few questions to start from
 * when there is nothing yet.
 */

const STARTERS = [
  "How do I release a flight?",
  "Why won't my flight release?",
  "How do I file a FRAT?",
  "How do I write up a squawk?",
];

export function AskPanel({
  chat,
  page,
  onNavigate,
}: {
  chat: HelpChat;
  /** Where the question is asked from: the page under the drawer. */
  page: PageRef;
  onNavigate: () => void;
}) {
  const { turns, draft, setDraft, busy, notice, ask, reset, full } = chat;
  const endRef = useRef<HTMLDivElement>(null);
  const last = turns[turns.length - 1];

  // Keep the newest words in view as they arrive.
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [turns.length, last?.content]);

  const send = () => {
    if (!busy && !full) void ask(draft, page);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
        {turns.length === 0 ? (
          <div data-testid="ask-empty">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Ask how to do something in Peregrine, or why something won&apos;t
              work. Answers come from Peregrine&apos;s help: the page guides,
              how-tos and FAQ.
            </p>
            <ul className="mt-3 space-y-1">
              {STARTERS.map((question) => (
                <li key={question}>
                  <button
                    type="button"
                    onClick={() => void ask(question, page)}
                    disabled={busy}
                    className="text-left text-xs text-primary hover:underline disabled:opacity-60"
                  >
                    {question}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ol className="space-y-4">
            {turns.map((turn, i) => (
              <li key={i} data-testid={`ask-turn-${turn.role}`}>
                <p className="eyebrow mb-1">{turn.role === "user" ? "You" : "Peregrine Help"}</p>
                {turn.role === "user" ? (
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
                    {turn.content}
                  </p>
                ) : turn.content ? (
                  <RichText
                    text={turn.content}
                    onNavigate={onNavigate}
                    className="text-xs text-muted-foreground"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">Working on it…</p>
                )}
                {turn.state === "cut" && (
                  <p className="mt-1 text-[0.68rem] text-muted-foreground">
                    The answer was cut short. Ask for the rest.
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border px-4 py-3">
        {notice && (
          <Notice tone="red" label="Not answered" className="mb-2">
            {notice}
          </Notice>
        )}
        {full ? (
          <p className="mb-2 text-xs text-muted-foreground">
            This conversation has reached its limit. Start a new one to ask more.
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label htmlFor="help-ask" className="sr-only">
              Your question
            </label>
            <textarea
              id="help-ask"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter asks; Shift+Enter is a new line.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              maxLength={MAX_QUESTION_CHARS}
              rows={2}
              placeholder="Ask a question"
              className="ff-input w-full resize-none px-3 py-2 text-xs"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[0.65rem] leading-snug text-muted-foreground">
                It can&apos;t see your flights or change anything.
              </p>
              <button
                type="submit"
                disabled={busy || !draft.trim()}
                className={cn(buttonSolid, "px-3 py-1.5 text-[0.68rem]")}
              >
                {busy ? "Answering…" : "Ask"}
              </button>
            </div>
          </form>
        )}
        {turns.length > 0 && (
          <button
            type="button"
            onClick={reset}
            className={cn(buttonOutline, "mt-2 w-full px-3 py-1.5 text-[0.68rem]")}
          >
            New conversation
          </button>
        )}
      </div>
    </div>
  );
}
