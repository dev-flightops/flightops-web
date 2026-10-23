import { describe, expect, it } from "vitest";

import { readEvents } from "./sse";

/** The answer arrives cut anywhere; only whole events come out (#114). */
describe("readEvents", () => {
  it("returns the whole events and keeps the rest for the next chunk", () => {
    const first = readEvents('data: {"type":"text","text":"Open "}\n\ndata: {"type":"te');
    expect(first.events).toEqual([{ type: "text", text: "Open " }]);
    const second = readEvents(`${first.rest}xt","text":"it."}\n\ndata: {"type":"done","stop_reason":"end_turn"}\n\n`);
    expect(second.events).toEqual([
      { type: "text", text: "it." },
      { type: "done", stop_reason: "end_turn" },
    ]);
    expect(second.rest).toBe("");
  });

  it("skips what it can't read rather than ending the answer", () => {
    const { events } = readEvents(
      'data: not json\n\ndata: {"type":"mystery"}\n\n: comment\n\ndata: {"type":"reset"}\r\n\r\n',
    );
    expect(events).toEqual([{ type: "reset" }]);
  });
});
