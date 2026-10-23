/**
 * The help assistant's answer, as it streams (#114).
 *
 * The ai service writes server-sent events, one JSON object each
 * (services/ai/app/help/assistant.py). Chunks arrive cut anywhere, so
 * this takes the text received so far and returns the events that are
 * complete and the remainder to keep for the next chunk.
 */

export type HelpEvent =
  | { type: "text"; text: string }
  /** A refusal fallback took over part-way: start the answer over. */
  | { type: "reset" }
  | { type: "done"; stop_reason: string }
  | { type: "refusal" }
  | { type: "error"; code: string };

const KNOWN = new Set(["text", "reset", "done", "refusal", "error"]);

export function readEvents(received: string): { events: HelpEvent[]; rest: string } {
  const blocks = received.replace(/\r\n/g, "\n").split("\n\n");
  const rest = blocks.pop() ?? "";
  const events: HelpEvent[] = [];
  for (const block of blocks) {
    for (const line of block.split("\n")) {
      if (!line.startsWith("data:")) continue;
      try {
        const event = JSON.parse(line.slice(5).trim()) as HelpEvent;
        if (event && KNOWN.has(event.type)) events.push(event);
      } catch {
        // A malformed event is skipped rather than ending the answer.
      }
    }
  }
  return { events, rest };
}
