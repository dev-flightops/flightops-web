import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";

// The column's own form controls are what's under test. Its panels are
// async server components with their own tests; stub them.
vi.mock("@/app/(app)/dispatch/risk-actions", () => ({ saveRiskInputsAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./alternate-review-panel", () => ({ AlternateReviewPanel: () => null }));
vi.mock("./fuel-order-panel", () => ({ FuelOrderPanel: () => null }));
// Arrives with the Load Team work (fix/dispatch-panel-labels); stubbed
// here so this test holds whichever of the two lands first.
vi.mock("./load-team-panel", () => ({ LoadTeamPanel: () => null }));
vi.mock("./maintenance-panel", () => ({ MaintenancePanel: () => null }));
vi.mock("./notam-acknowledgment-panel", () => ({ NotamAcknowledgmentPanel: () => null }));
vi.mock("./route-input", () => ({ RouteInput: () => null }));
vi.mock("./stale-weather-ack", () => ({ StaleWeatherAck: () => null }));
vi.mock("./weather-panel", () => ({ WeatherPanel: () => null }));

import type { DispatchRisk } from "@/lib/api/dispatch-risk";
import type { FlightDetail } from "@/lib/api/types";

import { LeftColumn } from "./left-column";

const RISK = {
  flight_id: "f-1",
  rows: [],
  max_score: 4,
  level: "LOW",
  management_required: false,
  concerns: [],
  summary: "",
  inputs: {
    flight_id: "f-1",
    outside_pilot_restrictions: false,
    vfr_mountain_night: false,
    management_approval_obtained: false,
    hazmat_approved: false,
    mel_actions_complete: false,
    reporting_override: null,
    night_override: null,
    crosswind_override_kt: null,
    maintenance_override: null,
    mel_override: null,
    mel_actions_override: null,
    hazmat_override: null,
    non_certified_notes: null,
    dispatcher_notes: null,
    area_forecast_product: null,
    updated_by: null,
    updated_at: null,
  },
  automatic: {
    reporting: { value: true, note: "" },
    night: { value: false, note: "" },
    crosswind_kt: 7,
    maintenance: { value: false, note: "100-hour due in 50.0 h" },
    mel: { value: false, note: "" },
    hazmat: { value: false, note: "" },
  },
} as const;

describe("LeftColumn's form controls", () => {
  // Every label sat beside its select unlinked: twelve selects on the
  // packet had no accessible name (axe select-name), so a screen reader
  // announced a row of unnamed Yes/No boxes. Since #50 they're the live
  // risk inputs, shown once a flight is picked.
  it("are each named by their label", async () => {
    const { container } = render(
      await LeftColumn({
        flight: { id: "f-1" } as FlightDetail,
        icaos: ["PABE", "PAEM"],
        notamAckedIcaos: [],
        weatherFreshness: null,
        staleWeatherAcknowledged: false,
        risk: RISK as unknown as DispatchRisk,
        canEditRisk: true,
      }),
    );
    for (const name of [
      "Hazmat Flight",
      "Hazmat Approved",
      "MEL/DMI on A/C",
      "Pilot Actions Required",
      "Reporting OK",
      "Night Ops",
      "Crosswind (kt)",
      "Outside Pilot Restrictions",
      "VFR Mtn Terrain at Night",
      "<4 hrs until MX",
      "Mgmt approval obtained",
      "MEL/DMI pilot actions complete",
    ]) {
      expect(screen.getByLabelText(name)).toBeInTheDocument();
    }
    await expectNoA11yViolations(container);
  });

  it("asks for a flight before showing the risk inputs", async () => {
    render(
      await LeftColumn({
        flight: null,
        icaos: [],
        notamAckedIcaos: [],
        weatherFreshness: null,
        staleWeatherAcknowledged: false,
      }),
    );
    expect(
      screen.getByText(
        "Pick a flight to set its compliance gates, risk inputs and management triggers.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Night Ops")).toBeNull();
  });
});
