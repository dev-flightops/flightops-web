import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { BoardFlightItem, FlightLeg } from "@/lib/api/types";

import { SummaryStatsBar } from "./summary-stats-bar";

const T = "2026-11-13T18:05:00Z";

const leg = (sequence: number, origin: string, destination: string, marks: Partial<FlightLeg> = {}): FlightLeg => ({
  sequence,
  origin,
  destination,
  scheduled_departure_at: "2026-11-13T18:00:00Z",
  scheduled_arrival_at: "2026-11-13T18:40:00Z",
  actual_departure_at: null,
  actual_arrival_at: null,
  ...marks,
});

const flight = (over: Partial<BoardFlightItem>) =>
  ({
    status: "released",
    origin: "PABE",
    destination: "PAKN",
    scheduled_departure_at: "2099-01-01T00:00:00Z",
    actual_departure_at: null,
    actual_arrival_at: null,
    legs: [],
    ...over,
  }) as BoardFlightItem;

describe("SummaryStatsBar", () => {
  it("counts a multi-stop flight airborne only while a leg is in the air (LOG-14)", () => {
    const landed = { actual_departure_at: T, actual_arrival_at: T };
    render(
      <SummaryStatsBar
        flights={[
          flight({ actual_departure_at: T }),
          flight({ actual_departure_at: T, legs: [leg(1, "PABE", "PADM", landed), leg(2, "PADM", "PAKN")] }),
          flight({
            actual_departure_at: T,
            legs: [leg(1, "PABE", "PADM", landed), leg(2, "PADM", "PAKN", { actual_departure_at: T })],
          }),
          flight({ scheduled_departure_at: "2020-01-01T00:00:00Z" }),
          flight({ status: "scheduled" }),
        ]}
      />,
    );
    expect(screen.getByText("Airborne").parentElement).toHaveTextContent(/^2Airborne$/);
    expect(screen.getByText("Released").parentElement).toHaveTextContent(/^1Released$/);
    expect(screen.getByText("Planned").parentElement).toHaveTextContent(/^1Planned$/);
    expect(screen.getByText("Delayed").parentElement).toHaveTextContent(/^1Delayed$/);
  });
});
