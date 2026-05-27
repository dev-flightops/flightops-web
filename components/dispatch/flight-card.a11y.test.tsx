import { render } from "@testing-library/react";
import { describe, it } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";
import type { FlightListItem } from "@/lib/api/types";

import { FlightCard } from "./flight-card";

const baseFlight: FlightListItem = {
  id: "00000000-0000-0000-0000-000000000001",
  flight_number: "GV101",
  origin: "PADU",
  destination: "PANC",
  scheduled_departure_at: "2026-05-27T14:00:00Z",
  scheduled_arrival_at: "2026-05-27T16:00:00Z",
  status: "scheduled",
  aircraft: {
    id: "ac-1",
    tail_number: "N207GE",
    model: "Cessna 208 Caravan",
    seats: 9,
  },
};

describe("FlightCard (a11y)", () => {
  it("scheduled flight passes WCAG A/AA", async () => {
    const { container } = render(<FlightCard flight={baseFlight} />);
    await expectNoA11yViolations(container);
  });

  it("released flight passes WCAG A/AA", async () => {
    const { container } = render(
      <FlightCard flight={{ ...baseFlight, status: "released" }} />,
    );
    await expectNoA11yViolations(container);
  });

  it("cancelled flight passes WCAG A/AA", async () => {
    const { container } = render(
      <FlightCard flight={{ ...baseFlight, status: "cancelled" }} />,
    );
    await expectNoA11yViolations(container);
  });
});
