import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AiQueryResult, QueryEntity, QuerySpec } from "@/lib/api/ai";

import {
  describeSpec,
  QueryView,
  SUGGESTIONS,
  type Turn,
} from "./query-view";

/**
 * Intelligence Query.
 *
 * Two things earn tests beyond the rendering. The suggestions must
 * only name things the catalogue holds — legacy's twelve mostly ask
 * for data ours deliberately does not expose, and a chip that
 * reliably answers "I cannot answer that" teaches people the tool is
 * broken. And the spec has to read back as something a person can
 * check, since it stands where legacy prints its SQL.
 */

function spec(over: Partial<QuerySpec> = {}): QuerySpec {
  return {
    entity: "aircraft",
    select: ["tail_number"],
    filters: [],
    group_by: [],
    aggregates: [],
    order_by: null,
    order_desc: false,
    limit: 50,
    ...over,
  };
}

function result(over: Partial<AiQueryResult> = {}): AiQueryResult {
  return {
    spec: spec(),
    columns: ["tail_number"],
    rows: [{ tail_number: "N100PA" }, { tail_number: "N200PA" }],
    refusal: null,
    ...over,
  };
}

const ENTITIES: QueryEntity[] = [
  {
    name: "aircraft",
    description: "The operator's fleet.",
    fields: ["tail_number", "model", "base"],
  },
  {
    name: "squawks",
    description: "Maintenance discrepancies.",
    fields: ["title", "severity", "status"],
  },
];

function view(turns: Turn[] = [], onAsk = vi.fn(), entities = ENTITIES) {
  render(
    <QueryView
      turns={turns}
      draft=""
      pending={false}
      entities={entities}
      onDraftChange={vi.fn()}
      onAsk={onAsk}
    />,
  );
  return onAsk;
}

describe("the suggestions", () => {
  it("only name entities the catalogue holds", () => {
    // Legacy offers "crew members with expired medical certificates",
    // "flights per pilot", "profit by route" — all of which our
    // registry refuses. A chip that reliably fails is worse than no
    // chip.
    const catalogue = [
      "aircraft",
      "flight",
      "squawk",
      "work order",
      "booking",
    ];
    for (const s of SUGGESTIONS) {
      const lower = s.toLowerCase();
      expect(
        catalogue.some((noun) => lower.includes(noun)),
        `"${s}" names nothing in the catalogue`,
      ).toBe(true);
    }
  });

  it("never mentions the things we deliberately do not expose", () => {
    // users, pilots by name, medicals, cost — the registry omits them
    // on purpose.
    const forbidden = ["pilot", "medical", "crew member", "profit", "cost"];
    for (const s of SUGGESTIONS) {
      for (const word of forbidden) {
        expect(
          s.toLowerCase().includes(word),
          `"${s}" suggests ${word}, which the catalogue cannot answer`,
        ).toBe(false);
      }
    }
  });

  it("asks the question when a chip is clicked", () => {
    const onAsk = view();
    fireEvent.click(screen.getByRole("button", { name: SUGGESTIONS[0] }));
    expect(onAsk).toHaveBeenCalledWith(SUGGESTIONS[0]);
  });
});

describe("the catalogue panel", () => {
  it("lists what the service says it can answer about", () => {
    // Rendered from the API, so what the page claims and what the
    // classifier accepts cannot drift apart.
    view();
    const panel = within(
      screen.getByRole("region", { name: "What I can answer about" }),
    );
    expect(panel.getByText("aircraft")).toBeInTheDocument();
    expect(panel.getByText(/tail_number, model, base/)).toBeInTheDocument();
  });

  it("is omitted when the service could not be reached", () => {
    // The question box still works; a help panel is not worth
    // failing the page over.
    view([], vi.fn(), []);
    expect(
      screen.queryByRole("region", { name: "What I can answer about" }),
    ).not.toBeInTheDocument();
  });
});

describe("an answer", () => {
  it("renders the rows against their columns", () => {
    view([{ id: 1, question: "which aircraft", at: "09:15", result: result() }]);
    expect(screen.getByText("N100PA")).toBeInTheDocument();
    expect(screen.getByText("2 rows")).toBeInTheDocument();
  });

  it("counts one row without pluralising", () => {
    view([
      {
        id: 1,
        question: "q",
        at: "09:15",
        result: result({ rows: [{ tail_number: "N100PA" }] }),
      },
    ]);
    expect(screen.getByText("1 row")).toBeInTheDocument();
  });

  it("says nothing matched rather than showing an empty table", () => {
    // A query that ran and matched nothing is an answer. An empty
    // table reads as a failure.
    view([{ id: 1, question: "q", at: "09:15", result: result({ rows: [] }) }]);
    expect(screen.getByText("Nothing matched that.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders a missing value as a dash, not as undefined", () => {
    view([
      {
        id: 1,
        question: "q",
        at: "09:15",
        result: result({
          columns: ["tail_number", "base"],
          rows: [{ tail_number: "N100PA" }],
        }),
      },
    ]);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("undefined")).not.toBeInTheDocument();
  });

  it("shows a refusal as an explanation, not an error", () => {
    // The asker did nothing wrong; the question is outside what the
    // catalogue holds.
    view([
      {
        id: 1,
        question: "list every user's email",
        at: "09:15",
        result: result({
          rows: [],
          columns: [],
          refusal: "I cannot answer that from the data I can see.",
        }),
      },
    ]);
    expect(
      screen.getByText(/I cannot answer that from the data I can see/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports a failure as an alert", () => {
    view([{ id: 1, question: "q", at: "09:15", error: "Try again." }]);
    expect(screen.getByRole("alert")).toHaveTextContent("Try again.");
  });

  it("says it is working before the answer lands", () => {
    view([{ id: 1, question: "q", at: "09:15" }]);
    expect(screen.getByText("Working on it…")).toBeInTheDocument();
  });
});

describe("what it understood", () => {
  it("is shown, where legacy prints the SQL it generated", () => {
    view([{ id: 1, question: "q", at: "09:15", result: result() }]);
    expect(screen.getByText("What I understood")).toBeInTheDocument();
  });

  it("is absent when there was no spec to show", () => {
    view([
      {
        id: 1,
        question: "q",
        at: "09:15",
        result: result({ spec: null, rows: [], refusal: "No." }),
      },
    ]);
    expect(screen.queryByText("What I understood")).not.toBeInTheDocument();
  });

  it("reads a plain selection back as a sentence", () => {
    expect(describeSpec(spec())).toBe("tail_number from aircraft");
  });

  it("reads an aggregate back", () => {
    expect(
      describeSpec(
        spec({ select: [], aggregates: [{ fn: "count", field: null }] }),
      ),
    ).toBe("count from aircraft");
  });

  it("reads filters back in words", () => {
    expect(
      describeSpec(
        spec({ filters: [{ field: "base", op: "eq", value: "PANC" }] }),
      ),
    ).toContain('where base eq "PANC"');
  });

  it("reads a null check back as words rather than an operator", () => {
    expect(
      describeSpec(
        spec({ filters: [{ field: "grounded_at", op: "is_not_null", value: null }] }),
      ),
    ).toContain("grounded_at is set");
  });

  it("reads grouping and ordering back", () => {
    const text = describeSpec(
      spec({
        select: [],
        group_by: ["severity"],
        aggregates: [{ fn: "count", label: "n" }],
        order_by: "n",
        order_desc: true,
      }),
    );
    expect(text).toContain("grouped by severity");
    expect(text).toContain("ordered by n (high to low)");
  });

  it("says everything when nothing was named", () => {
    expect(describeSpec(spec({ select: [] }))).toBe("everything from aircraft");
  });
});

describe("money columns", () => {
  it("formats an aggregate whose label dropped the cents suffix", () => {
    // Observed live: asked for booking value by destination, the model
    // labelled its sum `total_value` one time and `total_value_cents`
    // another. The label is its choice; the source field is ours.
    view([
      {
        id: 1,
        question: "booking value by destination",
        at: "09:15",
        result: result({
          spec: spec({
            entity: "bookings",
            select: [],
            group_by: ["destination_icao"],
            aggregates: [
              { fn: "sum", field: "quoted_total_cents", label: "total_value" },
            ],
          }),
          columns: ["destination_icao", "total_value"],
          rows: [{ destination_icao: "PABE", total_value: 1250000 }],
        }),
      },
    ]);
    expect(screen.getByText("$12,500")).toBeInTheDocument();
    expect(screen.queryByText("1250000")).not.toBeInTheDocument();
  });

  it("does not treat a count of a money column as an amount", () => {
    view([
      {
        id: 1,
        question: "q",
        at: "09:15",
        result: result({
          spec: spec({
            select: [],
            aggregates: [
              { fn: "count", field: "quoted_total_cents", label: "n" },
            ],
          }),
          columns: ["n"],
          rows: [{ n: 12 }],
        }),
      },
    ]);
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("renders a cents column as dollars", () => {
    // Printed raw, 1250000 reads as $1.25M rather than the $12,500 it
    // is — the same hundred-fold misreading the executive summary had.
    view([
      {
        id: 1,
        question: "booking value",
        at: "09:15",
        result: result({
          columns: ["destination_icao", "total_value_cents"],
          rows: [{ destination_icao: "PABE", total_value_cents: 1250000 }],
        }),
      },
    ]);
    expect(screen.getByText("$12,500")).toBeInTheDocument();
    expect(screen.queryByText("1250000")).not.toBeInTheDocument();
  });

  it("puts the sign outside the symbol", () => {
    view([
      {
        id: 1,
        question: "q",
        at: "09:15",
        result: result({
          columns: ["quoted_total_cents"],
          rows: [{ quoted_total_cents: -5000 }],
        }),
      },
    ]);
    expect(screen.getByText("-$50")).toBeInTheDocument();
  });

  it("leaves a non-money column alone", () => {
    view([
      {
        id: 1,
        question: "q",
        at: "09:15",
        result: result({
          columns: ["pax_count"],
          rows: [{ pax_count: 1250000 }],
        }),
      },
    ]);
    expect(screen.getByText("1250000")).toBeInTheDocument();
  });

  it("still dashes a null money value", () => {
    view([
      {
        id: 1,
        question: "q",
        at: "09:15",
        result: result({
          columns: ["total_value_cents"],
          rows: [{ total_value_cents: null }],
        }),
      },
    ]);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
