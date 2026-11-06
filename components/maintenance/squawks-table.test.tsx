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

vi.mock("@/components/maintenance/submit-rts-dialog", () => ({
  SubmitRtsDialog: ({ squawkId, name, rii }: { squawkId: string; name: string; rii?: boolean }) => (
    <button data-testid="submit-rts" data-squawk-id={squawkId} data-name={name} data-rii={String(rii)}>
      Submit RTS
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

it("retains the resolution reason, resolver and time for closed discrepancies", () => {
  render(<SquawksTable items={[makeSquawk({ id: "closed", status: "resolved", resolution_notes: "Synthetic grounding condition cleared", resolved_by: { id: "u-2", full_name: "UAT Resolver", email: "resolver@demo.example" }, resolved_at: "2026-11-04T08:41:00Z" })]} />);
  expect(screen.getByText("Resolution record")).toBeInTheDocument();
  expect(screen.getByText("Synthetic grounding condition cleared")).toBeInTheDocument();
  expect(screen.getByText(/UAT Resolver/)).toBeInTheDocument();
  expect(screen.getByText(/08:41z/)).toBeInTheDocument();
});

describe("the sign-off on a squawk (#172)", () => {
  it("offers Submit RTS beside Resolve, starting from the viewer's name", () => {
    render(<SquawksTable items={[makeSquawk({ id: "s-1" })]} canResolve signerName="Mo Mechanic" />);
    const button = screen.getByTestId("submit-rts");
    expect(button).toHaveAttribute("data-name", "Mo Mechanic");
    expect(button).toHaveAttribute("data-rii", "false");
    expect(screen.getByTestId("resolve-squawk")).toBeInTheDocument();
  });

  it("offers neither to someone who can't sign, nor on a resolved squawk", () => {
    render(<SquawksTable items={[makeSquawk({ id: "s-1" })]} />);
    expect(screen.queryByTestId("submit-rts")).toBeNull();
    document.body.innerHTML = "";
    render(<SquawksTable items={[makeSquawk({ id: "s-1", status: "resolved" })]} canResolve />);
    expect(screen.queryByTestId("submit-rts")).toBeNull();
  });

  it("sends a squawk waiting for its inspector to the queue, with nothing to go round it", () => {
    render(
      <SquawksTable
        items={[makeSquawk({ id: "s-1", status: "in_progress", is_rii: true, awaiting_rii: true })]}
        canResolve
      />,
    );
    expect(screen.getByText("Awaiting RII")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /RII sign-off/ })).toHaveAttribute("href", "/maintenance/rts");
    expect(screen.queryByTestId("submit-rts")).toBeNull();
    expect(screen.queryByTestId("resolve-squawk")).toBeNull();
  });

  it("keeps an RII flagged when it comes back after a rejection", () => {
    render(<SquawksTable items={[makeSquawk({ id: "s-1", is_rii: true })]} canResolve />);
    expect(screen.getByTestId("submit-rts")).toHaveAttribute("data-rii", "true");
    expect(screen.queryByTestId("resolve-squawk")).toBeNull();
  });

  it("records who signed on a resolved squawk", () => {
    render(
      <SquawksTable
        items={[
          makeSquawk({
            id: "s-1",
            status: "resolved",
            resolution_notes: "Replaced it.",
            rts_amt_name: "Mo Mechanic",
            rts_amt_cert_type: "ap",
            rts_amt_cert_number: "1234567",
            rii_inspector_name: "Ines Inspector",
            rii_inspector_cert_number: "7654321",
          }),
        ]}
      />,
    );
    expect(screen.getByText("Signed off by Mo Mechanic, A&P 1234567")).toBeInTheDocument();
    expect(screen.getByText("RII inspected by Ines Inspector, 7654321")).toBeInTheDocument();
  });
});
