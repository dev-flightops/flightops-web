import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DelayAssessment } from "@/lib/api/ai";
import type { FlightListItem } from "@/lib/api/types";

const assessDelayAction = vi.fn();
vi.mock("./actions", () => ({
  assessDelayAction: (...a: unknown[]) => assessDelayAction(...a),
}));

import { FlightRiskList } from "./flight-risk-list";

/**
 * Delay risk, per flight.
 *
 * The assertions that earn their place are the ones legacy gets wrong:
 * no invented score, a missing rate said rather than zeroed, and the
 * measured figures surviving a model that did not answer.
 */

function flight(over: Partial<FlightListItem> = {}): FlightListItem {
  return {
    id: "f-1",
    flight_number: "PGR205",
    origin: "PAKN",
    destination: "PADU",
    scheduled_departure_at: "2026-09-09T20:02:00Z",
    scheduled_arrival_at: "2026-09-09T22:02:00Z",
    status: "scheduled",
    aircraft: {
      id: "ac-1",
      tail_number: "N100PA",
      model: "Cessna 208 Caravan",
      seats: 9,
    },
    ...over,
  };
}

function assessment(over: Partial<DelayAssessment> = {}): DelayAssessment {
  return {
    flight_id: "f-1",
    flight_number: "PGR205",
    window_days: 180,
    route: {
      origin: "PAKN",
      destination: "PADU",
      flights: 20,
      completed: 18,
      cancelled: 1,
      late: 4,
      cancellation_rate: 0.05,
      late_rate: 0.2,
      enough_history: true,
    },
    aircraft: {
      tail: "N100PA",
      flights: 8,
      late: 0,
      open_squawks: 1,
      grounding_squawks: 0,
      open_mels: 0,
      is_grounded: false,
    },
    note: null,
    advisory: "Advisory only. The counts are measured from your own history.",
    judgement: {
      risk_band: "low",
      contributing_factors: [
        { factor: "Aircraft reliability", detail: "8 flown, 0 late." },
      ],
      historical_context: "The route runs on time most days.",
      recommendation: "No action beyond the normal brief.",
    },
    ...over,
  };
}

async function assess(over: Partial<DelayAssessment> = {}) {
  assessDelayAction.mockResolvedValue({ status: "ok", data: assessment(over) });
  render(<FlightRiskList flights={[flight()]} />);
  fireEvent.click(screen.getByRole("button", { name: "Assess" }));
  await waitFor(() => expect(assessDelayAction).toHaveBeenCalled());
}

beforeEach(() => assessDelayAction.mockReset());

describe("the day's list", () => {
  it("says so when the day is empty", () => {
    render(<FlightRiskList flights={[]} />);
    expect(screen.getByText(/no flights scheduled on this day/i)).toBeInTheDocument();
  });

  it("shows the flight without assessing it first", () => {
    // Each assessment spends a model call, so nothing runs on load.
    render(<FlightRiskList flights={[flight()]} />);
    expect(screen.getByText("PGR205")).toBeInTheDocument();
    expect(screen.getByText("PAKN → PADU")).toBeInTheDocument();
    expect(screen.getByText("ETD 20:02z")).toBeInTheDocument();
    expect(assessDelayAction).not.toHaveBeenCalled();
  });
});

describe("a band, never a score", () => {
  it("shows the band the service returned", async () => {
    await assess({
      judgement: { ...assessment().judgement!, risk_band: "high" },
    });
    expect(await screen.findByText("high risk")).toBeInTheDocument();
  });

  it("never renders a percentage risk figure", async () => {
    // Legacy badges "73% risk" from a model-supplied 0-100 score. The
    // service refuses to produce one because no calculation over a
    // handful of counts lands on 73 rather than 68, and a two-digit
    // number beside measured figures borrows their authority.
    await assess();
    expect(screen.queryByText(/% risk/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\/100/)).not.toBeInTheDocument();
  });
});

describe("measured figures", () => {
  it("renders the rates the service computed", async () => {
    await assess();
    expect(await screen.findByText("20%")).toBeInTheDocument(); // late
    expect(screen.getByText("5%")).toBeInTheDocument(); // cancelled
  });

  it("says a missing rate rather than showing zero", async () => {
    // Legacy prints 0% when there is no history, turning "we do not
    // know" into "it never happens" — the more dangerous of the two on
    // a page about risk.
    await assess({
      route: {
        ...assessment().route,
        flights: 1,
        late_rate: null,
        cancellation_rate: null,
        enough_history: false,
      },
    });
    expect(await screen.findAllByText("not enough history")).toHaveLength(2);
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
    expect(
      screen.getByText(/too few prior flights on this route/i),
    ).toBeInTheDocument();
  });

  it("surfaces open squawks and MELs on the tail", async () => {
    await assess({
      aircraft: {
        ...assessment().aircraft,
        open_squawks: 2,
        grounding_squawks: 1,
        open_mels: 3,
      },
    });
    const line = await screen.findByText(/2 open squawks/);
    expect(line).toHaveTextContent("1 grounding");
    expect(line).toHaveTextContent("3 open MELs");
  });

  it("survives the model not answering", async () => {
    // A missing judgement costs the reading, not the history.
    await assess({ judgement: null });
    expect(await screen.findByText("20%")).toBeInTheDocument();
    expect(
      screen.getByText(/no reading was produced/i),
    ).toBeInTheDocument();
  });
});

describe("the reading", () => {
  it("shows context, factors and recommendation", async () => {
    await assess();
    expect(
      await screen.findByText("The route runs on time most days."),
    ).toBeInTheDocument();
    expect(screen.getByText("Aircraft reliability")).toBeInTheDocument();
    expect(
      screen.getByText("No action beyond the normal brief."),
    ).toBeInTheDocument();
  });

  it("renders the advisory from the payload", async () => {
    await assess({ advisory: "Bespoke advisory from the service." });
    expect(
      await screen.findByText("Bespoke advisory from the service."),
    ).toBeInTheDocument();
  });

  it("is text, never markup", async () => {
    await assess({
      judgement: {
        ...assessment().judgement!,
        recommendation: '<img src=x onerror="alert(1)">careful',
      },
    });
    const el = await screen.findByText(/careful/);
    expect(el.querySelector("img")).toBeNull();
  });

  it("offers a re-assessment once one has run", async () => {
    await assess();
    expect(
      await screen.findByRole("button", { name: "Re-assess" }),
    ).toBeInTheDocument();
  });
});

describe("when one flight fails", () => {
  it("shows the reason on that row", async () => {
    assessDelayAction.mockResolvedValue({
      status: "error",
      message: "That flight no longer exists. Refresh the day.",
    });
    render(<FlightRiskList flights={[flight()]} />);
    fireEvent.click(screen.getByRole("button", { name: "Assess" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no longer exists/,
    );
  });

  it("leaves the other rows alone", async () => {
    // A per-row failure must not take the list with it.
    assessDelayAction.mockResolvedValue({
      status: "error",
      message: "Could not reach the assessment service.",
    });
    render(
      <FlightRiskList
        flights={[flight(), flight({ id: "f-2", flight_number: "PGR900" })]}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Assess" })[0]);
    await screen.findByRole("alert");
    expect(screen.getByText("PGR900")).toBeInTheDocument();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });
});
