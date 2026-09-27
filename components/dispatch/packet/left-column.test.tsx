import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";

// The column's own form controls are what's under test. Its panels are
// async server components with their own tests; stub them.
vi.mock("./alternate-review-panel", () => ({ AlternateReviewPanel: () => null }));
vi.mock("./fuel-order-panel", () => ({ FuelOrderPanel: () => null }));
vi.mock("./maintenance-panel", () => ({ MaintenancePanel: () => null }));
vi.mock("./notam-acknowledgment-panel", () => ({ NotamAcknowledgmentPanel: () => null }));
vi.mock("./route-input", () => ({ RouteInput: () => null }));
vi.mock("./stale-weather-ack", () => ({ StaleWeatherAck: () => null }));
vi.mock("./weather-panel", () => ({ WeatherPanel: () => null }));

import { LeftColumn } from "./left-column";

describe("LeftColumn's form controls", () => {
  // Every label sat beside its select unlinked: twelve selects on the
  // packet had no accessible name (axe select-name), so a screen reader
  // announced a row of unnamed Yes/No boxes.
  it("are each named by their label", async () => {
    const { container } = render(
      await LeftColumn({
        flight: null,
        icaos: [],
        notamAckedIcaos: [],
        weatherFreshness: null,
        staleWeatherAcknowledged: false,
      }),
    );
    for (const name of [
      "Hazmat Flight",
      "Hazmat Approved",
      "MEL/DMI on A/C",
      "Pilot Actions Required",
      "IFR / VFR",
      "Reporting OK",
      "Night Ops",
      "Crosswind (kt)",
      "Outside Pilot Restrictions",
      "VFR Mtn Terrain at Night",
      "<4 hrs until MX",
    ]) {
      expect(screen.getByLabelText(name)).toBeInTheDocument();
    }
    await expectNoA11yViolations(container);
  });
});
