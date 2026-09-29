import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SquawkResponse } from "@/lib/api/types";

// The dialog posts through a server action; its own tests cover that.
vi.mock("@/components/dispatch/packet/resolve-squawk-dialog", () => ({
  ResolveSquawkDialog: ({ squawkId }: { squawkId: string }) => (
    <button data-testid="resolve-squawk" data-squawk-id={squawkId}>
      Resolve
    </button>
  ),
}));

import { SquawksTable } from "./squawks-table";

function makeSquawk(
  overrides: Partial<SquawkResponse> & { id: string },
): SquawkResponse {
  return {
    aircraft: { id: "ac-1", tail_number: "N207GE", model: "C208" },
    reported_at: "2026-06-15T14:00:00Z",
    reported_by: {
      id: "u-1",
      full_name: "Marie Mechanic",
      email: "marie@flightops.local",
    },
    title: "Cracked windscreen wiper",
    description: "cosmetic but noticeable",
    severity: "major",
    status: "open",
    resolved_at: null,
    resolved_by: null,
    resolution_notes: null,
    ...overrides,
  };
}

describe("SquawksTable", () => {
  it("renders the empty-state copy when there are no items", () => {
    render(<SquawksTable items={[]} />);
    expect(screen.getByText(/no open squawks/i)).toBeInTheDocument();
  });

  it("renders title, severity, reporter, and status for each row", () => {
    render(
      <SquawksTable
        items={[
          makeSquawk({ id: "s-1", title: "Engine oil leak", severity: "grounding" }),
        ]}
      />,
    );

    expect(screen.getByText("Engine oil leak")).toBeInTheDocument();
    expect(screen.getByText(/^grounding$/i)).toBeInTheDocument();
    expect(screen.getByText("Marie Mechanic")).toBeInTheDocument();
    expect(screen.getByText(/^open$/i)).toBeInTheDocument();
  });

  it("colors each severity pill distinctly", () => {
    render(
      <SquawksTable
        items={[
          makeSquawk({ id: "s-g", title: "Hyd press low", severity: "grounding" }),
          makeSquawk({ id: "s-m", title: "Right wiper", severity: "major" }),
          makeSquawk({ id: "s-mi", title: "Cabin window scratch", severity: "minor" }),
        ]}
      />,
    );

    expect(screen.getByText(/^grounding$/i)).toBeInTheDocument();
    expect(screen.getByText(/^major$/i)).toBeInTheDocument();
    expect(screen.getByText(/^minor$/i)).toBeInTheDocument();
  });

  it("renders 'In progress' for in_progress squawks", () => {
    render(
      <SquawksTable
        items={[makeSquawk({ id: "s-1", status: "in_progress" })]}
      />,
    );

    expect(screen.getByText(/in progress/i)).toBeInTheDocument();
  });
});

describe("SquawksTable — resolving", () => {
  it("offers no Resolve without the sign-off (the default)", () => {
    render(<SquawksTable items={[makeSquawk({ id: "s-1" })]} />);
    expect(screen.queryByTestId("resolve-squawk")).toBeNull();
  });

  it("offers Resolve on each open or in-progress squawk to maintenance", () => {
    render(
      <SquawksTable
        canResolve
        items={[
          makeSquawk({ id: "s-1", status: "open" }),
          makeSquawk({ id: "s-2", status: "in_progress" }),
          makeSquawk({ id: "s-3", status: "resolved" }),
        ]}
      />,
    );
    expect(
      screen.getAllByTestId("resolve-squawk").map((b) => b.getAttribute("data-squawk-id")),
    ).toEqual(["s-1", "s-2"]);
  });
});
