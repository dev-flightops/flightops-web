import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FlightDetail, VillageBoardRow } from "@/lib/api/types";

vi.mock("./actions", () => ({ completeStepAction: vi.fn() }));

import { WeatherAndNotamStep } from "./step-4-weather-notam";

describe("Step 3 on a multi-leg flight", () => {
  it("asks for weather and NOTAMs at every stop", () => {
    // The release checks every stop of a multi-leg route (client,
    // 27 Sep), so the pilot's review covers every stop too.
    const flight = {
      id: "f-1",
      origin: "PABE",
      destination: "PASM",
      stops: ["PABE", "PAHP", "PASM"],
    } as FlightDetail;
    render(<WeatherAndNotamStep flightId="f-1" flight={flight} weather={null} />);
    for (const icao of ["PABE", "PAHP", "PASM"]) {
      expect(screen.getAllByText(icao).length).toBeGreaterThan(0);
    }
  });
});

describe("pilot village weather review", () => {
  const flight = { id: "f-1", origin: "PANC", destination: "PAII" } as FlightDetail;
  const row = {
    airport: { id: "va-1", icao: "PAII", name: "Egegik", has_instrument_approach: false },
    latest_report: {
      id: "r-1", reported_at: new Date(Date.now() - 65 * 60_000).toISOString(),
      reported_by_name: "Village observer", cloud_cover: "SCT", ceiling_ft: 400,
      visibility_sm: 10, flight_category: "VFR", notes: "Clear over the river",
      photos: [{ id: "photo-1" }],
    },
  } as VillageBoardRow;

  it("shows the route's village observation and photos even when METAR is unavailable", () => {
    render(<WeatherAndNotamStep flightId="f-1" flight={flight} weather={null} villages={[row]} />);
    expect(screen.getByText("Village Report")).toBeInTheDocument();
    expect(screen.getByText("Clear over the river")).toBeInTheDocument();
    expect(screen.getByText(/Village observer/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Photo 1 of 1/ })).toHaveAttribute("href", "/api/village-photos/photo-1");
    expect(screen.getByText(/No instrument approach/)).toBeInTheDocument();
    expect(screen.getByText(/VFR.*SCT 400ft/)).toBeInTheDocument();
  });

  it("does not present a report for an airport outside this flight's route", () => {
    render(<WeatherAndNotamStep flightId="f-1" flight={{...flight, destination:"PABE"}} weather={null} villages={[row]} />);
    expect(screen.queryByText("Clear over the river")).not.toBeInTheDocument();
  });

  it("makes failure to load village reports visible", () => {
    render(<WeatherAndNotamStep flightId="f-1" flight={flight} weather={null} villages={null} />);
    expect(screen.getAllByText(/Village reports could not be loaded/).length).toBe(2);
  });
});
