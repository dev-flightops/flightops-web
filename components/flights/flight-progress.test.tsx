import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { FlightProgressResponse } from "@/lib/api/types";

import { FlightProgress, buildGaps } from "./flight-progress";

const progress = (over: Partial<FlightProgressResponse> = {}): FlightProgressResponse => ({
  flight_id: "fl-118",
  status: "scheduled",
  steps: [
    { key: "built", label: "Flight built", state: "done", turn: "dispatch", by_name: null, at: null, notes: [] },
    {
      key: "frat_dispatcher",
      label: "FRAT signed by dispatch",
      state: "done",
      turn: "dispatch",
      by_name: "Dana Dispatch",
      at: "2026-11-09T01:51:00Z",
      notes: [],
    },
    { key: "frat_pilot", label: "FRAT signed by the pilot", state: "todo", turn: "pilot", by_name: null, at: null, notes: [] },
    { key: "released", label: "Released", state: "todo", turn: "dispatch", by_name: null, at: null, notes: [] },
  ],
  next: { key: "frat_pilot", label: "FRAT signed by the pilot", state: "todo", turn: "pilot", by_name: null, at: null, notes: [] },
  ...over,
});

describe("a flight's progress (#175)", () => {
  it("says whose turn it is and who did what", () => {
    render(<FlightProgress progress={progress()} timeZone="America/Anchorage" />);
    expect(screen.getByText("Next: FRAT signed by the pilot.")).toBeInTheDocument();
    expect(screen.getByText(/Dana Dispatch, Nov 8, 16:51/)).toBeInTheDocument();
    expect(screen.getByText("FRAT signed by the pilot").closest("li")).toHaveAttribute("aria-current", "step");
  });

  it("names whose turn it is only where the step doesn't", () => {
    const released: FlightProgressResponse["next"] = { key: "released", label: "Released", state: "todo", turn: "dispatch", by_name: null, at: null, notes: [] };
    render(<FlightProgress progress={progress({ next: released })} timeZone="America/Anchorage" />);
    expect(screen.getByText("Next: Released, dispatch's turn.")).toBeInTheDocument();
  });

  it("lists what a flight not built still needs, for dispatch's sign-off", () => {
    const notBuilt = progress({
      steps: [
        {
          key: "built",
          label: "Flight built",
          state: "todo",
          turn: "dispatch",
          by_name: null,
          at: null,
          notes: ["No PIC on the flight yet."],
        },
      ],
      next: {
        key: "built",
        label: "Flight built",
        state: "todo",
        turn: "dispatch",
        by_name: null,
        at: null,
        notes: ["No PIC on the flight yet."],
      },
    });
    render(<FlightProgress progress={notBuilt} timeZone="America/Anchorage" />);
    expect(screen.getByText("No PIC on the flight yet.")).toBeInTheDocument();
    expect(buildGaps(notBuilt)).toEqual(["No PIC on the flight yet."]);
    expect(buildGaps(progress())).toEqual([]);
    expect(buildGaps(null)).toEqual([]);
  });
});
