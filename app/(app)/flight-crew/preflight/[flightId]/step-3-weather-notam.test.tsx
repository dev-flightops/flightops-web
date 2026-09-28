import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FlightDetail } from "@/lib/api/types";

vi.mock("./actions", () => ({ completeStepAction: vi.fn() }));

import { WeatherAndNotamStep } from "./step-3-weather-notam";

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
