import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SquawkResponse } from "@/lib/api/types";

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
