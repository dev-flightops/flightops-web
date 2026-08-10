import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("renders 'Planned' for scheduled flights", () => {
    render(<StatusBadge status="scheduled" />);
    expect(screen.getByText(/planned/i)).toBeInTheDocument();
  });

  it("renders 'Released' (yellow) when status=released and no actual_departure_at", () => {
    // Regression guard for the LOG-1 fix: the row-pill used to always
    // say AIRBORNE for released flights, even when actual_departure_at
    // was NULL and the "Mark Departed" button was next to it.
    const { container } = render(
      <StatusBadge status="released" actualDepartureAt={null} />,
    );
    expect(screen.getByText(/^released$/i)).toBeInTheDocument();
    // Yellow tint distinguishes released-on-ground from airborne;
    // the token comes from the shared status-color palette.
    expect(container.firstChild).toHaveClass("text-status-yellow");
  });

  it("renders 'Airborne' (green) when status=released and actual_departure_at is set", () => {
    const { container } = render(
      <StatusBadge
        status="released"
        actualDepartureAt="2026-08-10T01:56:25Z"
      />,
    );
    expect(screen.getByText(/^airborne$/i)).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("text-status-green");
  });

  it("falls back to the legacy 'Airborne' label when actualDepartureAt is omitted", () => {
    // Callers that don't have the field (surfaces that don't render
    // released-on-ground rows — /history for completed+cancelled,
    // /eod for scheduled-only) keep the legacy label rather than
    // erroneously showing 'Released'.
    render(<StatusBadge status="released" />);
    expect(screen.getByText(/^airborne$/i)).toBeInTheDocument();
  });

  it("renders 'Landed' for completed flights", () => {
    render(<StatusBadge status="completed" />);
    expect(screen.getByText(/landed/i)).toBeInTheDocument();
  });

  it("renders 'Cancelled' for cancelled flights", () => {
    render(<StatusBadge status="cancelled" />);
    expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
  });
});
