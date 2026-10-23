"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { useAssistant } from "@/components/assistant/assistant-context";
import { startersFor } from "@/components/assistant/starters";
import { BotGlyph, CloseGlyph, SendGlyph } from "@/components/ff/glyphs";
import { Notice } from "@/components/ff/notice";
import { RichText } from "@/components/help/rich-text";
import { MAX_QUESTION_CHARS } from "@/components/help/use-help-chat";
import { pageRef } from "@/lib/help/page-ref";
import { cn } from "@/lib/utils";

/**
 * Peregrine Assistant (#114): the chat that answers questions about using
 * Peregrine, from its help content, on every page.
 *
 * Greg (23 Oct): an AI assistant like other platforms have, above the
 * Safety button, with a bot. So a launcher in the Safety button's idiom
 * (a square button, an UPPERCASE label, the brand fill where Safety has
 * red) stacked above it, opening a chat window over the page: a card
 * above the launcher on a desktop, the whole screen on a phone, where the
 * top bar's ? isn't shown.
 *
 * The window shows the conversation the layout holds (assistant-context),
 * so it carries on across pages and opens again where it was left. On a
 * desktop it stays open while a link in an answer is followed, so the
 * answer can be read beside the page it describes; on a phone the page
 * needs the screen, so the window closes.
 */

/** The Safety button's own page, where it isn't shown. */
const SAFETY_INTAKE = "/safety/reports/new";

function Avatar({ large = false }: { large?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-md bg-primary text-primary-foreground",
        large ? "h-9 w-9" : "h-6 w-6",
      )}
    >
      <BotGlyph size={large ? 20 : 14} />
    </span>
  );
}

function Thinking() {
  return (
    <span role="status" aria-label="Thinking" className="inline-flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-pulse bg-muted-foreground"
          style={{ animationDelay: `${i * 180}ms` }}
        />
      ))}
    </span>
  );
}

export function AssistantWidget() {
  const assistant = useAssistant();
  const pathname = usePathname() ?? "/";
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const open = assistant?.open ?? false;
  const turns = assistant?.chat.turns ?? [];
  const last = turns[turns.length - 1];

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") assistant?.setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, assistant]);

  // Keep the newest words in view as they arrive.
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [open, turns.length, last?.content]);

  if (!assistant) return null;
  const { chat, setOpen, name, roles } = assistant;
  const { draft, setDraft, busy, notice, ask, reset, full } = chat;
  const page = pageRef(pathname);
  const send = () => {
    if (!busy && !full) void ask(draft, page);
  };
  const followed = () => {
    if (!window.matchMedia("(min-width: 640px)").matches) setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="peregrine-assistant"
        aria-label={open ? "Close Peregrine Assistant" : "Ask Peregrine Assistant"}
        className={cn(
          "btn-caps fixed right-6 z-30 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-primary-foreground shadow-[0_2px_12px_rgb(0_0_0/0.35)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          pathname === SAFETY_INTAKE ? "bottom-6" : "bottom-[4.5rem]",
        )}
      >
        {open ? <CloseGlyph size={14} /> : <BotGlyph size={16} />}
        {open ? "Close" : "Ask AI"}
      </button>

      {open && (
        <div
          id="peregrine-assistant"
          role="dialog"
          aria-label="Peregrine Assistant"
          className={cn(
            "fixed inset-0 z-50 flex flex-col bg-card",
            "sm:inset-auto sm:right-6 sm:z-40 sm:h-[min(36rem,calc(100dvh-9.5rem))] sm:w-[24rem] sm:rounded-lg sm:border sm:border-border sm:shadow-[0_8px_32px_rgb(0_0_0/0.4)]",
            pathname === SAFETY_INTAKE ? "sm:bottom-[4.5rem]" : "sm:bottom-[7.75rem]",
          )}
        >
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Avatar large />
            <div className="min-w-0 flex-1">
              <h2 className="panel-title truncate whitespace-nowrap">Peregrine Assistant</h2>
              <p className="mt-0.5 truncate text-[0.68rem] text-muted-foreground">
                Answers from Peregrine&apos;s help
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close Peregrine Assistant"
              className="rounded p-1.5 text-muted-foreground hover:text-foreground"
            >
              <CloseGlyph size={14} />
            </button>
          </div>

          <div
            className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
            aria-live="polite"
            aria-busy={busy}
            data-testid="assistant-log"
          >
            {turns.length === 0 ? (
              <div data-testid="assistant-welcome">
                <div className="flex items-start gap-2.5">
                  <Avatar />
                  <div className="rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs leading-relaxed">
                    <p className="font-semibold text-foreground">
                      {name ? `Hi ${name}, I'm` : "I'm"} Peregrine Assistant.
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Ask me how to do something in Peregrine, or why something won&apos;t
                      work. I answer from Peregrine&apos;s help pages.
                    </p>
                  </div>
                </div>
                <p className="eyebrow mb-2 mt-5">Try asking</p>
                <ul className="space-y-1.5">
                  {startersFor(roles).map((question) => (
                    <li key={question}>
                      <button
                        type="button"
                        onClick={() => void ask(question, page)}
                        disabled={busy}
                        className="w-full rounded-md border border-border px-3 py-2 text-left text-xs text-foreground transition hover:border-primary hover:bg-accent disabled:opacity-60"
                      >
                        {question}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              turns.map((turn, i) =>
                turn.role === "user" ? (
                  <div key={i} data-testid="assistant-turn-user" className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-primary px-3 py-2 text-xs leading-relaxed text-primary-foreground">
                      {turn.content}
                    </p>
                  </div>
                ) : (
                  <div key={i} data-testid="assistant-turn-assistant" className="flex items-start gap-2.5">
                    <Avatar />
                    <div className="min-w-0 max-w-[85%] rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs text-foreground">
                      {turn.content ? (
                        <RichText text={turn.content} onNavigate={followed} />
                      ) : (
                        <Thinking />
                      )}
                      {turn.state === "cut" && (
                        <p className="mt-1 text-[0.68rem] text-muted-foreground">
                          The answer was cut short. Ask for the rest.
                        </p>
                      )}
                    </div>
                  </div>
                ),
              )
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-border px-3 py-3">
            {notice && (
              <Notice tone="red" label="Not answered" className="mb-2">
                {notice}
              </Notice>
            )}
            {full ? (
              <p className="text-xs text-muted-foreground">
                This conversation has reached its limit. Start a new chat to ask more.
              </p>
            ) : (
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <label htmlFor="assistant-question" className="sr-only">
                  Your question
                </label>
                <textarea
                  id="assistant-question"
                  ref={inputRef}
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
                  rows={Math.min(5, Math.max(1, draft.split("\n").length))}
                  placeholder="Ask about Peregrine"
                  className="ff-input min-h-[2.25rem] flex-1 resize-none px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  aria-label="Send"
                  disabled={busy || !draft.trim()}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
                >
                  <SendGlyph size={14} />
                </button>
              </form>
            )}
            <div className="mt-2 flex items-start justify-between gap-3">
              <p className="text-[0.62rem] leading-snug text-muted-foreground">
                Answers come from Peregrine&apos;s help. It can&apos;t see your flights or change
                anything.
              </p>
              {turns.length > 0 && (
                <button
                  type="button"
                  onClick={reset}
                  className="btn-caps shrink-0 rounded px-1.5 py-0.5 text-[0.62rem] text-primary hover:underline"
                >
                  New chat
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
