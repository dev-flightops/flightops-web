import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FleetAircraftSummary } from "@/lib/api/types";
import { FleetAirworthinessPanel } from "./fleet-airworthiness-panel";

describe("fleet manual grounding", () => {
  it("does not label an inactive, manually grounded aircraft airworthy when it has no maintenance blockers", () => {
    render(<FleetAirworthinessPanel fleet={[{
      aircraft: { id: "held", tail_number: "N96DM", model: "Caravan" },
      is_active: false, is_airworthy: true, grounded_at: "2026-11-02T03:00:00Z",
      blocking_count: 0, advisory_count: 0, open_squawk_count: 0, open_mel_count: 0,
    } as FleetAircraftSummary]} />);
    const aircraft = within(screen.getByRole("link", { name: /N96DM/ }));
    expect(aircraft.getByText("Grounded")).toBeInTheDocument();
    expect(aircraft.queryByText("Airworthy")).toBeNull();
    expect(screen.getByText(/pending RTS/)).toHaveTextContent("1 pending RTS");
  });
});
