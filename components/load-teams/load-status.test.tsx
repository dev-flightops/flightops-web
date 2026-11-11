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

/** The line's words after its mark: the stamps, then the ramp timer. */
const words = (container: HTMLElement) => (container.querySelector("span.ml-1")?.textContent ?? "").replace(/\s+/g, " ");

describe("where a load stands (#134)", () => {
  it("is assigned, then acknowledged, then loading, then complete", () => {
    expect(loadStage(base)).toBe("assigned");
    expect(loadStage({ ...base, acknowledged_at: "2026-11-03T11:47:00Z" })).toBe("acknowledged");
    expect(loadStage({ ...base, acknowledged_at: "2026-11-03T11:47:00Z", load_started_at: "2026-11-03T11:50:00Z" })).toBe(
      "loading",
    );
    expect(
      loadStage({ ...base, acknowledged_at: "2026-11-03T11:47:00Z", load_completed_at: "2026-11-03T11:58:00Z" }),
    ).toBe("complete");
  });

  it("names the team while no one has acknowledged it", () => {
    const { container } = render(<LoadStatusLine assignment={base} timeZone="America/Anchorage" />);
    expect(screen.getByText("Not acknowledged")).toBeInTheDocument();
    expect(words(container)).toMatch(/^Anchorage Load Team A · Not started, /);
  });

  it("says who acknowledged it and when, at the base's time", () => {
    const { container } = render(
      <LoadStatusLine
        assignment={{ ...base, acknowledged_at: "2026-11-03T11:47:00Z", acknowledged_by: nina }}
        timeZone="America/Anchorage"
      />,
    );
    expect(screen.getByText("Acknowledged")).toBeInTheDocument();
    expect(words(container)).toMatch(/^acknowledged 02:47 AKST · by Nina Brightwater · Not started, /);
  });

  it("says who started loading and when (LOG-43)", () => {
    const { container } = render(
      <LoadStatusLine
        assignment={{
          ...base,
          acknowledged_at: "2026-11-03T11:47:00Z",
          load_started_at: "2026-11-03T11:50:00Z",
          load_started_by: nina,
        }}
        timeZone="America/Anchorage"
      />,
    );
    expect(screen.getByText("Loading")).toBeInTheDocument();
    expect(words(container)).toMatch(/^started 02:50 AKST · by Nina Brightwater · Loading /);
  });

  it("says who completed it, when, and the photos", () => {
    const { container } = render(
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
    expect(words(container)).toBe("02:58 AKST · by Nina Brightwater · 2 photos · Loaded 1 h 7 min before departure");
  });

  it("times a load that began and ended against the departure", () => {
    const { container } = render(
      <LoadStatusLine
        assignment={{
          ...base,
          acknowledged_at: "2026-11-03T11:47:00Z",
          load_started_at: "2026-11-03T12:50:00Z",
          load_completed_at: "2026-11-03T13:10:00Z",
          load_completed_by: nina,
        }}
        timeZone="America/Anchorage"
      />,
    );
    expect(words(container)).toBe("04:10 AKST · by Nina Brightwater · Loaded in 20 min, 5 min after the scheduled departure");
    expect(screen.getByText("Loaded in 20 min, 5 min after the scheduled departure")).toHaveClass("text-status-red");
  });

  it("doesn't time a load on a flight that closed without it", () => {
    const { container } = render(
      <LoadStatusLine assignment={{ ...base, flight: { ...base.flight, status: "cancelled" } }} timeZone="America/Anchorage" />,
    );
    expect(words(container)).toBe("Anchorage Load Team A");
  });
});
