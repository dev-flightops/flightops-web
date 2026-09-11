import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { MxAnswer } from "@/lib/api/ai";

import { MxTranscript, type MxTurn } from "./mx-transcript";

/**
 * The MX Intelligence transcript.
 *
 * Two things here are worth a test rather than a glance. The model's
 * output reaches the page as a text node — legacy assigns it to
 * `innerHTML` — and the context line has to say what was *not* read,
 * because a truncated squawk list otherwise reads as the whole
 * history.
 */

function reply(overrides: Partial<MxAnswer> = {}): MxAnswer {
  return {
    answer: "Right brake has been soft twice on N200PA.",
    model: "stub",
    advisory: "Not an airworthiness determination.",
    context: {
      aircraft: 2,
      aircraft_grounded: 1,
      squawks_shown: 2,
      squawks_omitted: 0,
      work_orders_shown: 1,
      work_orders_omitted: 0,
      mel_items_shown: 1,
      mel_items_omitted: 0,
    },
    ...overrides,
  };
}

function turn(overrides: Partial<MxTurn> = {}): MxTurn {
  return {
    id: 1,
    prompt: "Any recurring squawks?",
    tail: null,
    at: "09:14",
    ...overrides,
  };
}

function view(turns: MxTurn[], onExample = vi.fn()) {
  render(
    <MxTranscript
      turns={turns}
      pending={false}
      examples={["Which aircraft has a recurring squawk?"]}
      onExample={onExample}
    />,
  );
  return onExample;
}

describe("the empty state", () => {
  it("offers examples the records can actually answer", async () => {
    const onExample = view([]);
    await userEvent.click(
      screen.getByRole("button", { name: /recurring squawk/i }),
    );
    expect(onExample).toHaveBeenCalledWith(
      "Which aircraft has a recurring squawk?",
    );
  });

  it("says up front what the tool cannot see", () => {
    // The prompt refuses to cite ADs or quote a maintenance manual. A
    // mechanic should know that before asking, not after getting a
    // hedged answer.
    view([]);
    expect(screen.getByText(/no access to your maintenance manuals/i)).toBeInTheDocument();
  });
});

describe("an answer", () => {
  it("renders the model's text as text, not markup", () => {
    // Legacy does `div.innerHTML = data.response`. If the model emits
    // a tag, legacy puts an element in the page and we put characters
    // on the screen.
    view([
      turn({
        reply: reply({ answer: "Check the <b>right</b> brake line." }),
      }),
    ]);
    expect(
      screen.getByText("Check the <b>right</b> brake line."),
    ).toBeInTheDocument();
    expect(document.querySelector("b")).toBeNull();
  });

  it("shows what was read", () => {
    view([turn({ reply: reply() })]);
    expect(screen.getByText(/Read 2 aircraft/)).toBeInTheDocument();
    expect(screen.getByText(/1 grounded/)).toBeInTheDocument();
  });

  it("shows what was not read, and how to narrow it", () => {
    // The failure this prevents: an answer over the most recent forty
    // squawks reading as an answer over all of them.
    view([
      turn({
        reply: reply({
          context: { ...reply().context, squawks_omitted: 12 },
        }),
      }),
    ]);
    expect(screen.getByText(/12 older squawks/)).toBeInTheDocument();
    expect(screen.getByText(/single tail to narrow it/i)).toBeInTheDocument();
  });

  it("says nothing about omissions when there are none", () => {
    // Or the warning becomes boilerplate and stops being read.
    view([turn({ reply: reply() })]);
    expect(screen.queryByText(/Not read:/)).not.toBeInTheDocument();
  });

  it("carries the advisory from the service, not a local copy", () => {
    view([turn({ reply: reply({ advisory: "Service-supplied wording." }) })]);
    expect(screen.getByText("Service-supplied wording.")).toBeInTheDocument();
  });

  it("shows the tail a question was scoped to", () => {
    view([turn({ tail: "N200PA", reply: reply() })]);
    expect(screen.getByText(/scoped to N200PA/i)).toBeInTheDocument();
  });
});

describe("the other two states", () => {
  it("says it is working while the answer is in flight", () => {
    view([turn()]);
    expect(screen.getByRole("status")).toHaveTextContent(
      /reading the maintenance records/i,
    );
  });

  it("shows why it failed rather than an empty bubble", () => {
    view([turn({ error: "MX Intelligence is unavailable right now." })]);
    expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/i);
  });

  it("keeps the question visible when the answer failed", () => {
    // So the mechanic can retry without retyping, and can see which
    // question failed when several are on screen.
    view([turn({ error: "boom" })]);
    expect(screen.getByText("Any recurring squawks?")).toBeInTheDocument();
  });
});
