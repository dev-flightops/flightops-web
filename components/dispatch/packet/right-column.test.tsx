import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { FlightDetail } from "@/lib/api/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/app/(app)/dispatch/[flightId]/actions", () => ({
  releaseFlightAction: vi.fn(),
}));

import { RightColumn } from "./right-column";

const baseFlight = (overrides: Partial<FlightDetail> = {}): FlightDetail => ({
  id: "flight-uuid-1",
  flight_number: "GV101",
  origin: "PADU",
  destination: "PANC",
  scheduled_departure_at: "2026-06-01T14:00:00Z",
  scheduled_arrival_at: "2026-06-01T16:00:00Z",
  status: "scheduled",
  aircraft: {
    id: "ac-1",
    tail_number: "N207GE",
    model: "Cessna 208 Caravan",
    seats: 9,
  },
  pax_count: 8,
  cargo_lbs: 450,
  notes: null,
  max_payload_lbs: 3000,
  released_at: null,
  released_by: null,
  ...overrides,
});

describe("RightColumn / Generate PDF button", () => {
  it("renders Generate PDF as a disabled button when no flight is selected", () => {
    render(<RightColumn />);
    const btn = screen.getByRole("button", { name: /Generate PDF/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute(
      "title",
      "Pick a scheduled flight above first",
    );
  });

  it("renders Generate PDF as a direct download link when the flight is already released", () => {
    render(<RightColumn flight={baseFlight({ status: "released" })} />);
    const link = screen.getByRole("link", { name: /Generate PDF/i });
    expect(link).toHaveAttribute(
      "href",
      "/api/dispatch/flight-uuid-1/release.pdf",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders Generate PDF as a button that opens the release-confirm dialog when the flight is still scheduled", async () => {
    const user = userEvent.setup();
    render(<RightColumn flight={baseFlight({ status: "scheduled" })} />);
    const btn = screen.getByRole("button", { name: /Generate PDF/i });
    expect(btn).not.toBeDisabled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(btn);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText(/Release GV101 and generate PDF/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Release & generate/i }),
    ).toBeInTheDocument();
  });

  it("keeps Refresh Weather + AI Review disabled regardless of selection", () => {
    render(<RightColumn flight={baseFlight()} />);
    expect(
      screen.getByRole("button", { name: /Refresh Weather/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /AI Review/i }),
    ).toBeDisabled();
  });
});
