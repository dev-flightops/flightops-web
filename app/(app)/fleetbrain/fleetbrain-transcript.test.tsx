import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FleetBrainReply } from "@/lib/api/ai";

import { FleetBrainTranscript, type Turn } from "./fleetbrain-transcript";

/**
 * The FleetBrain conversation.
 *
 * The interesting cases are the three states a turn can be in — asked
 * and waiting, answered, failed — and the table, which is the only
 * part that reads structure out of the API rather than a single
 * string.
 */

function reply(over: Partial<FleetBrainReply["answer"]> = {}): FleetBrainReply {
  return {
    intent: {
      intent_type: "aircraft_status",
      params: {},
      confidence: 0.8,
      raw_query: "fleet status",
    },
    answer: {
      summary: "8 aircraft — 3 active, 5 grounded.",
      columns: [],
      rows: [],
      badges: [],
      suggestions: [],
      intent_type: "aircraft_status",
      unsupported: false,
      ...over,
    },
  };
}

const EXAMPLES = ["Give me an ops summary", "Fleet status"];

function renderTranscript(turns: Turn[] = [], onPick = vi.fn()) {
  render(
    <FleetBrainTranscript
      turns={turns}
      examples={EXAMPLES}
      onPick={onPick}
    />,
  );
  return onPick;
}

describe("the welcome state", () => {
  it("offers the examples the service supplied", () => {
    // Not typed into this component — they come from the module that
    // owns the intents, so a suggestion cannot drift away from what
    // the classifier accepts.
    renderTranscript();
    for (const q of EXAMPLES) {
      expect(screen.getByRole("button", { name: q })).toBeInTheDocument();
    }
  });

  it("asks the question when an example is picked", () => {
    const onPick = renderTranscript();
    fireEvent.click(screen.getByRole("button", { name: "Fleet status" }));
    expect(onPick).toHaveBeenCalledWith("Fleet status");
  });
});

describe("a turn in flight", () => {
  const waiting: Turn = { id: 1, query: "fleet status", at: "14:02" };

  it("shows the question immediately", () => {
    // The dispatcher's own words go up before the answer arrives —
    // otherwise a slow query looks like a dropped one.
    renderTranscript([waiting]);
    expect(screen.getByText("fleet status")).toBeInTheDocument();
    expect(screen.getByText("14:02")).toBeInTheDocument();
  });

  it("says it is working rather than showing nothing", () => {
    renderTranscript([waiting]);
    expect(screen.getByText("Thinking…")).toBeInTheDocument();
  });
});

describe("an answered turn", () => {
  it("renders the summary", () => {
    renderTranscript([
      { id: 1, query: "fleet status", at: "14:02", reply: reply() },
    ]);
    expect(
      screen.getByText("8 aircraft — 3 active, 5 grounded."),
    ).toBeInTheDocument();
  });

  it("shows what it understood, so a wrong answer is traceable", () => {
    renderTranscript([
      { id: 1, query: "fleet status", at: "14:02", reply: reply() },
    ]);
    expect(
      screen.getByText(/intent: aircraft_status \(80%\)/),
    ).toBeInTheDocument();
  });

  it("renders badges with their own colour", () => {
    renderTranscript([
      {
        id: 1,
        query: "fleet status",
        at: "14:02",
        reply: reply({
          badges: [
            { text: "3 active", color: "green" },
            { text: "5 grounded", color: "red" },
          ],
        }),
      },
    ]);
    expect(screen.getByText("3 active").className).toMatch(/status-green/);
    expect(screen.getByText("5 grounded").className).toMatch(/status-red/);
  });

  it("offers the follow-up suggestions", () => {
    const onPick = renderTranscript([
      {
        id: 1,
        query: "fleet status",
        at: "14:02",
        reply: reply({ suggestions: ["Open squawks"] }),
      },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Open squawks" }));
    expect(onPick).toHaveBeenCalledWith("Open squawks");
  });
});

describe("the table", () => {
  const withRows = reply({
    columns: ["Tail", "Status"],
    rows: [
      { Tail: "N100PA", Status: "Active" },
      { Tail: "N200PA", Status: "Grounded" },
    ],
  });

  it("renders a header per column, in order", () => {
    renderTranscript([
      { id: 1, query: "fleet status", at: "14:02", reply: withRows },
    ]);
    const headers = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(headers).toEqual(["Tail", "Status"]);
  });

  it("reads each cell by its column label", () => {
    // The API keys rows by the exact column label, so no key-munging
    // is needed to line them up — legacy lowercases and replaces
    // spaces to guess at the key, which breaks on any column it did
    // not anticipate.
    renderTranscript([
      { id: 1, query: "fleet status", at: "14:02", reply: withRows },
    ]);
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("N100PA")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Grounded")).toBeInTheDocument();
  });

  it("colours the cells a dispatcher is scanning for", () => {
    renderTranscript([
      { id: 1, query: "fleet status", at: "14:02", reply: withRows },
    ]);
    expect(screen.getByText("Grounded").className).toMatch(/status-red/);
    expect(screen.getByText("Active").className).toMatch(/status-green/);
  });

  it("keeps a wide table inside its own scroller", () => {
    // Nine columns must not push the page sideways.
    const { container } = render(
      <FleetBrainTranscript
        turns={[{ id: 1, query: "q", at: "14:02", reply: withRows }]}
        examples={[]}
        onPick={vi.fn()}
      />,
    );
    expect(
      container.querySelector("table")?.closest("div")?.className,
    ).toMatch(/overflow-x-auto/);
  });

  it("renders no table when there are no rows", () => {
    renderTranscript([
      { id: 1, query: "fleet status", at: "14:02", reply: reply() },
    ]);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders an empty cell rather than the word undefined", () => {
    // A column the row does not carry is a gap, not the string
    // "undefined" printed into the table.
    renderTranscript([
      {
        id: 1,
        query: "q",
        at: "14:02",
        reply: reply({
          columns: ["Tail", "Base"],
          rows: [{ Tail: "N100PA" }],
        }),
      },
    ]);
    expect(screen.queryByText("undefined")).not.toBeInTheDocument();
  });
});

describe("understood but not held", () => {
  it("says so instead of naming an intent", () => {
    // "We don't track that" and "I didn't follow that" are different
    // answers, and the line under the reply must not read the same
    // for both.
    renderTranscript([
      {
        id: 1,
        query: "parts inventory",
        at: "14:02",
        reply: {
          intent: {
            intent_type: "inventory_status",
            params: {},
            confidence: 0.8,
            raw_query: "parts inventory",
          },
          answer: {
            ...reply().answer,
            summary: "Parts inventory isn't tracked in this system yet.",
            intent_type: "inventory_status",
            unsupported: true,
          },
        },
      },
    ]);
    expect(screen.getByText(/not tracked here/)).toBeInTheDocument();
    expect(screen.queryByText(/intent: inventory_status/)).toBeNull();
  });
});

describe("a failed turn", () => {
  it("reports the failure without losing the question", () => {
    renderTranscript([
      {
        id: 1,
        query: "fleet status",
        at: "14:02",
        error: "FleetBrain is unavailable right now. Try again in a moment.",
      },
    ]);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "FleetBrain is unavailable right now.",
    );
    expect(screen.getByText("fleet status")).toBeInTheDocument();
  });

  it("does not also claim to be thinking", () => {
    renderTranscript([
      { id: 1, query: "q", at: "14:02", error: "Nope." },
    ]);
    expect(screen.queryByText("Thinking…")).not.toBeInTheDocument();
  });
});
