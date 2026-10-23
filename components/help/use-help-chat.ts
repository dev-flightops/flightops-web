"use client";

import { useCallback, useRef, useState } from "react";

import { readEvents } from "@/lib/help/sse";

/**
 * The help assistant's conversation (#114): what was asked, what came
 * back, and the question being typed.
 *
 * Held by the help panel, which stays mounted while its drawer is shut,
 * so an answer keeps arriving after the drawer closes and the
 * conversation is still there when it opens again, on any page.
 *
 * A QUESTION THAT GETS NO ANSWER LEAVES NO TRACE
 *
 * A failed or declined question is taken back out of the conversation
 * and put back in the box with the reason. The service wants questions
 * and answers in turn, and a question with no answer after it would
 * break that for every question after.
 */

export interface PageRef {
  route: string;
  title?: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  /** Where a question was asked from. */
  page?: PageRef;
  /** An answer still arriving, or one that ran out of room. */
  state?: "streaming" | "cut";
}

/** Ten questions and their answers; the service takes one more. */
export const MAX_EXCHANGES = 10;
export const MAX_QUESTION_CHARS = 4000;

function failureFor(status: number, code?: string, retryAfter?: string | null): string {
  if (status === 401) return "Your session expired. Sign in again to ask.";
  if (status === 403) return "Help questions are for staff logins.";
  if (status === 422) return "That conversation is too long to go on with. Start a new one.";
  if (status === 429) {
    const minutes = Math.max(1, Math.ceil(Number(retryAfter ?? 60) / 60));
    return `That's a lot of questions in a short time. Ask again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
  }
  if (status === 503 && code === "anthropic_not_configured") {
    return "Peregrine Help isn't set up on this system yet.";
  }
  return "Peregrine Help couldn't answer just now. Try again.";
}

function failureForEvent(code: string): string {
  if (code === "anthropic_rate_limited") return "Peregrine Help is busy. Try again in a minute.";
  if (code === "anthropic_timeout") return "That took too long to answer. Try again.";
  return "Peregrine Help couldn't answer just now. Try again.";
}

export function useHelpChat() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  // State updates only on the next render, so two quick Enters would both
  // see `busy` false; the ref sees the first at once.
  const inFlight = useRef(false);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    inFlight.current = false;
    setTurns([]);
    setBusy(false);
    setNotice(null);
  }, []);

  const ask = useCallback(
    async (question: string, page: PageRef) => {
      const text = question.trim();
      if (!text || busy || inFlight.current) return;
      inFlight.current = true;
      const history = turns.filter((t) => t.state !== "streaming");
      const asked: ChatTurn = { role: "user", content: text, page };
      setTurns([...history, asked, { role: "assistant", content: "", state: "streaming" }]);
      setDraft("");
      setNotice(null);
      setBusy(true);

      const answer = (content: string, state?: ChatTurn["state"]) =>
        setTurns((now) => [...now.slice(0, -1), { role: "assistant", content, state }]);
      const takeBack = (reason: string) => {
        setTurns(history);
        setDraft(text);
        setNotice(reason);
      };

      const controller = new AbortController();
      controllerRef.current = controller;
      try {
        const response = await fetch("/api/help/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...history, asked].map(({ role, content, page: from }) =>
              role === "user" ? { role, content, page: from } : { role, content },
            ),
          }),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          takeBack(failureFor(response.status, body?.error, response.headers.get("retry-after")));
          return;
        }
        if (!response.headers.get("content-type")?.includes("text/event-stream")) {
          // A signed-out request is sent to the sign-in page before it
          // reaches the route, and fetch follows it there: a 200 that
          // isn't an answer.
          takeBack(response.redirected ? failureFor(401) : failureFor(502));
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let received = "";
        let content = "";
        let ended = false;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          received += decoder.decode(value, { stream: true });
          const { events, rest } = readEvents(received);
          received = rest;
          for (const event of events) {
            if (event.type === "text") {
              content += event.text;
              answer(content, "streaming");
            } else if (event.type === "reset") {
              content = "";
              answer("", "streaming");
            } else if (event.type === "done") {
              ended = true;
              answer(content, event.stop_reason === "max_tokens" ? "cut" : undefined);
            } else if (event.type === "refusal") {
              takeBack("Peregrine Help can't answer that one. Try asking it another way.");
              return;
            } else {
              takeBack(failureForEvent(event.code));
              return;
            }
          }
        }
        if (!ended) takeBack("The answer was cut off on the way. Try again.");
      } catch {
        if (!controller.signal.aborted) {
          takeBack("Couldn't reach Peregrine Help. Check your connection and try again.");
        }
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
          inFlight.current = false;
          setBusy(false);
        }
      }
    },
    [busy, turns],
  );

  const exchanges = turns.filter((t) => t.role === "user").length;
  return {
    turns,
    draft,
    setDraft,
    busy,
    notice,
    ask,
    reset,
    full: exchanges >= MAX_EXCHANGES,
  };
}

export type HelpChat = ReturnType<typeof useHelpChat>;
