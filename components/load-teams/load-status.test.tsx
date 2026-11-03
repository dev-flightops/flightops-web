import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { FlightAssignmentResponse } from "@/lib/api/types";

import { LoadStatusLine, loadStage } from "./load-status";

const base: FlightAssignmentResponse = {
  id: "as-1",
  flight: {
    id: "fl-1",
    flight_number: "DEMO104",
    origin: "PANC",
    destination: "PABE",
    scheduled_departure_at: "2026-11-03T13:05:00Z",
    status: "released",
  },
  load_team: { id: "lt-1", team_name: "Anchorage Load Team A", base_icao: "PANC", color_code: "#60a5fa" },
  assigned_by: null,
  assigned_at: "2026-11-03T11:45:00Z",
  cleared_at: null,
  cleared_by: null,
  note: null,
};
const nina = { id: "u-1", full_name: "Nina Brightwater", email: "n@x" };

describe("where a load stands (#134)", () => {
  it("is assigned, then acknowledged, then complete", () => {
    expect(loadStage(base)).toBe("assigned");
    expect(loadStage({ ...base, acknowledged_at: "2026-11-03T11:47:00Z" })).toBe("acknowledged");
    expect(
      loadStage({ ...base, acknowledged_at: "2026-11-03T11:47:00Z", load_completed_at: "2026-11-03T11:58:00Z" }),
    ).toBe("complete");
  });

  it("names the team while no one has acknowledged it", () => {
    render(<LoadStatusLine assignment={base} timeZone="America/Anchorage" />);
    expect(screen.getByText("Not acknowledged")).toBeInTheDocument();
    expect(screen.getByText("Anchorage Load Team A")).toBeInTheDocument();
  });

  it("says who acknowledged it and when, at the base's time", () => {
    render(
      <LoadStatusLine
        assignment={{ ...base, acknowledged_at: "2026-11-03T11:47:00Z", acknowledged_by: nina }}
        timeZone="America/Anchorage"
      />,
    );
    expect(screen.getByText("Loading")).toBeInTheDocument();
    expect(screen.getByText("acknowledged 02:47 AKST · by Nina Brightwater")).toBeInTheDocument();
  });

  it("says who completed it, when, and the photos", () => {
    render(
      <LoadStatusLine
        assignment={{
          ...base,
          acknowledged_at: "2026-11-03T11:47:00Z",
          load_completed_at: "2026-11-03T11:58:00Z",
          load_completed_by: nina,
          photo_count: 2,
        }}
        timeZone="America/Anchorage"
      />,
    );
    expect(screen.getByText("Load complete")).toBeInTheDocument();
    expect(screen.getByText("02:58 AKST · by Nina Brightwater · 2 photos")).toBeInTheDocument();
  });
});
