import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ManifestDetailResponse, ManifestPaxRow } from "@/lib/api/manifest";
import type { FlightAssignmentResponse } from "@/lib/api/types";

import { PreflightLoad, PreflightPassengers } from "./preflight-load-passengers";

const ALASKA = "America/Anchorage";

// 20 Nov, the client: "Can we get a load/passenger checked in status on the
// flight screen as well? Just like the fuel shows completed."
describe("the load, beside the fuel", () => {
  const assignment = (over: Partial<FlightAssignmentResponse> = {}) =>
    ({
      id: "as-1",
      flight: { id: "f-1", flight_number: "PGR792", status: "released", scheduled_departure_at: "2026-11-21T21:00:00Z" },
      load_team: { team_name: "Bethel Load Team" },
      acknowledged_at: "2026-11-21T19:00:00Z",
      load_started_at: "2026-11-21T20:10:00Z",
      load_completed_at: "2026-11-21T20:30:00Z",
      load_completed_by: { full_name: "Owen Staley" },
      photo_count: 2,
      ...over,
    }) as unknown as FlightAssignmentResponse;

  it("says the load is complete, by whom and when, in the base's time", () => {
    render(<PreflightLoad assignment={assignment()} timeZone={ALASKA} />);
    const box = screen.getByRole("region", { name: "Load" });
    expect(within(box).getByText("Load complete")).toBeInTheDocument();
    expect(within(box).getByText(/11:30 AKST · by Owen Staley · 2 photos/)).toBeInTheDocument();
    expect(within(box).getByText("Bethel Load Team")).toBeInTheDocument();
  });

  it("says when no load team is on it, and when it couldn't be read", () => {
    const { rerender } = render(<PreflightLoad assignment={null} timeZone={ALASKA} />);
    expect(screen.getByText(/No load team on it yet/)).toBeInTheDocument();
    rerender(<PreflightLoad assignment={undefined} timeZone={ALASKA} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Load unavailable");
  });
});

describe("the passengers, beside the fuel", () => {
  const pax = (first: string, over: Partial<ManifestPaxRow> = {}) =>
    ({
      id: `p-${first}`,
      first_name: first,
      last_name: "Nicolai",
      is_crew: false,
      check_in_status: "booked",
      checked_in_at: null,
      boarded_at: null,
      ...over,
    }) as unknown as ManifestPaxRow;
  const manifest = (rows: ManifestPaxRow[]) => ({ pax: rows }) as unknown as ManifestDetailResponse;

  it("says all are checked in once every one is, with each one's time", () => {
    render(
      <PreflightPassengers
        flightId="f-1"
        timeZone={ALASKA}
        manifest={manifest([
          pax("John", { check_in_status: "checked_in", checked_in_at: "2026-11-21T20:20:00Z" }),
          pax("Rose", { check_in_status: "boarded", boarded_at: "2026-11-21T20:45:00Z" }),
          pax("Cal", { is_crew: true }),
        ])}
      />,
    );
    const box = screen.getByRole("region", { name: "Passengers" });
    expect(within(box).getByText("All 2 checked in")).toBeInTheDocument();
    expect(within(box).getByText("Checked in 11:20 AKST")).toBeInTheDocument();
    expect(within(box).getByText("Boarded 11:45 AKST")).toBeInTheDocument();
    // The crew ride on the manifest but aren't passengers.
    expect(within(box).queryByText("Cal Nicolai")).toBeNull();
    expect(within(box).getByRole("link", { name: /Check in passengers/ })).toHaveAttribute("href", "/check-in/f-1");
  });

  it("counts who's still to come, and doesn't wait for a no-show", () => {
    render(
      <PreflightPassengers
        flightId="f-1"
        timeZone={ALASKA}
        manifest={manifest([
          pax("John", { check_in_status: "checked_in", checked_in_at: "2026-11-21T20:20:00Z" }),
          pax("Rose"),
          pax("Sam", { check_in_status: "no_show" }),
        ])}
      />,
    );
    const box = screen.getByRole("region", { name: "Passengers" });
    expect(within(box).getByText("1 of 2 checked in")).toBeInTheDocument();
    expect(within(box).getByText("To check in")).toBeInTheDocument();
    expect(within(box).getByText("No-show")).toBeInTheDocument();
  });

  it("says when there's nobody on the manifest, and when it couldn't be read", () => {
    const { rerender } = render(<PreflightPassengers flightId="f-1" timeZone={ALASKA} manifest={null} />);
    expect(screen.getByText("No passengers on the manifest.")).toBeInTheDocument();
    rerender(<PreflightPassengers flightId="f-1" timeZone={ALASKA} manifest={undefined} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Passengers unavailable");
  });
});
