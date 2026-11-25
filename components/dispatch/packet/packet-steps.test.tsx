import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Each panel a step can hold, as a marker: the packet in steps (24 Nov)
// moves today's panels into steps, so what matters is which step gets which.
const { marker } = vi.hoisted(() => ({
  marker: (name: string) => () => <div data-testid={name} />,
}));
vi.mock("./route-input", () => ({ RouteInput: marker("route") }));
vi.mock("./weather-panel", () => ({ WeatherPanel: marker("weather") }));
vi.mock("./weather-minimums-notice", () => ({ WeatherMinimumsNotice: marker("minimums") }));
vi.mock("./stale-weather-ack", () => ({ StaleWeatherAck: marker("stale-weather") }));
vi.mock("./alternate-review-panel", () => ({ AlternateReviewPanel: marker("alternate") }));
vi.mock("./notam-acknowledgment-panel", () => ({ NotamAcknowledgmentPanel: marker("notams") }));
vi.mock("./maintenance-panel", () => ({ MaintenancePanel: marker("maintenance") }));
vi.mock("./fuel-order-panel", () => ({ FuelOrderPanel: marker("fuel-order") }));
vi.mock("./load-team-panel", () => ({ LoadTeamPanel: marker("load-team") }));
vi.mock("./risk-inputs", () => ({
  ComplianceGatesInputs: marker("compliance-gates"),
  CompanyRiskInputs: marker("company-risk"),
  ManagementTriggers: marker("management"),
  DispatcherNotes: marker("dispatcher-notes"),
  AreaForecastSelect: marker("area-forecast"),
}));
vi.mock("./refresh-weather-button", () => ({ RefreshWeatherButton: marker("refresh-weather") }));
vi.mock("./generate-pdf-button", () => ({ GeneratePdfButton: marker("generate-pdf") }));
vi.mock("./risk-assessment-panel", () => ({ RiskAssessmentPanel: marker("risk-matrix") }));
vi.mock("@/components/dispatch/release-button", () => ({ ReleaseButton: marker("release") }));
vi.mock("@/components/dispatch/edit-flight-dialog", () => ({ EditFlightDialog: marker("edit") }));
vi.mock("@/components/dispatch/status-badge", () => ({ StatusBadge: marker("status") }));
vi.mock("@/components/dispatch/cancel-flight", () => ({ CancelFlight: marker("cancel") }));
vi.mock("@/components/dispatch/move-flight-day", () => ({ MoveFlightDay: marker("move") }));
vi.mock("@/components/dispatch/withdraw-release", () => ({ WithdrawRelease: marker("withdraw") }));
vi.mock("@/components/dispatch/released-footer", () => ({ ReleasedFooter: marker("released-footer") }));
vi.mock("@/components/dispatch/download-pdf-button", () => ({ DownloadPdfButton: marker("download-pdf") }));
vi.mock("@/components/records/delete-flight", () => ({ DeleteFlight: marker("delete") }));
vi.mock("@/components/frat/frat-signoffs", () => ({ FratSignoffs: marker("frat-signoffs") }));
vi.mock("@/components/manifest/leg-load-panel", () => ({ LegLoadPanel: marker("leg-load") }));
vi.mock("@/components/manifest/balance-scope-note", () => ({ BalanceScopeNote: marker("balance-note") }));
vi.mock("@/app/(app)/manifest/[flightId]/fuel-form", () => ({ PlannedFuelForm: marker("fuel-form") }));

import type { DispatchRisk } from "@/lib/api/dispatch-risk";
import type { FlightDetail } from "@/lib/api/types";

import { LeftColumn } from "./left-column";
import { PacketStep, PacketStepStrip, type PacketStepInfo } from "./packet-steps";
import { ReleaseReadinessPanel } from "./release-readiness-panel";
import { RightColumn } from "./right-column";

const FLIGHT = {
  id: "f-1",
  flight_number: "PGR800",
  status: "scheduled",
  origin: "PABE",
  destination: "PABE",
  stops: ["PABE", "PAHP", "PAVA", "PABE"],
  scheduled_departure_at: "2026-11-24T19:30:00Z",
  is_ifr: true,
  alternate_ident: "PAEM",
  aircraft: { id: "ac-1", tail_number: "N503PA", model: "Grand Caravan" },
} as unknown as FlightDetail;
const RISK = { inputs: {}, stops: [] } as unknown as DispatchRisk;

const present = () =>
  Array.from(document.querySelectorAll("[data-testid]"))
    .map((el) => el.getAttribute("data-testid"))
    .sort();

const STEPS: PacketStepInfo[] = [
  { id: "step-weather", n: 1, title: "Weather", state: "done" },
  { id: "step-aircraft", n: 2, title: "Aircraft and pilot", state: "attention", notes: ["No PIC on this flight's crew."] },
  { id: "step-load", n: 3, title: "Weight and balance", state: "waiting" },
  { id: "step-frat", n: 4, title: "FRAT", state: "attention", notes: ["FRAT: a", "FRAT: b"] },
  { id: "step-release", n: 5, title: "Release", state: "waiting" },
];

describe("the step strip", () => {
  it("links each step in the client's order, with its state and what holds it", () => {
    render(<PacketStepStrip steps={STEPS} />);
    const links = within(screen.getByRole("navigation", { name: "Dispatch steps" })).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "#step-weather",
      "#step-aircraft",
      "#step-load",
      "#step-frat",
      "#step-release",
    ]);
    expect(links[0]).toHaveAccessibleName("Step 1: Weather, done");
    expect(links[1]).toHaveAccessibleName("Step 2: Aircraft and pilot, needs attention");
    expect(links[3]).toHaveTextContent("FRAT2");
  });
});

describe("a step", () => {
  it("names what holds it when it needs attention", () => {
    render(
      <PacketStep info={STEPS[1]} summary="N503PA · no PIC yet">
        <p>panels</p>
      </PacketStep>,
    );
    expect(screen.getByRole("heading", { name: "Aircraft and pilot" })).toBeInTheDocument();
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "What holds aircraft and pilot" })).toHaveTextContent(
      "No PIC on this flight's crew.",
    );
    expect(screen.getByText("N503PA · no PIC yet")).toBeInTheDocument();
  });

  it("lists nothing when it's done", () => {
    render(
      <PacketStep info={STEPS[0]}>
        <p>panels</p>
      </PacketStep>,
    );
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});

describe("LeftColumn by step", () => {
  const props = {
    flight: FLIGHT,
    icaos: ["PABE", "PAHP", "PAVA"],
    notamAckedIcaos: [],
    weatherFreshness: null,
    staleWeatherAcknowledged: false,
    risk: RISK,
    canEditRisk: true,
  };

  it("keeps every panel without a step", async () => {
    render(await LeftColumn(props));
    expect(present()).toEqual(
      [
        "alternate",
        "company-risk",
        "compliance-gates",
        "fuel-order",
        "load-team",
        "maintenance",
        "management",
        "minimums",
        "notams",
        "route",
        "stale-weather",
        "weather",
      ].sort(),
    );
  });

  it("gives the weather step the route, the weather, the minimums, stale weather, the alternate and the NOTAMs", async () => {
    render(await LeftColumn({ ...props, part: "weather" }));
    expect(present()).toEqual(["alternate", "minimums", "notams", "route", "stale-weather", "weather"]);
  });

  it("gives the aircraft step maintenance, the load step fuel and the load team, the FRAT step the risk inputs", async () => {
    const { unmount } = render(await LeftColumn({ ...props, part: "aircraft" }));
    expect(present()).toEqual(["maintenance"]);
    unmount();
    const load = render(await LeftColumn({ ...props, part: "load" }));
    expect(present()).toEqual(["fuel-order", "load-team"]);
    load.unmount();
    render(await LeftColumn({ ...props, part: "risk" }));
    expect(present()).toEqual(["company-risk", "compliance-gates", "management"]);
  });
});

describe("RightColumn by step", () => {
  it("gives the weather step Refresh Weather, the FRAT step the matrix, the release step the flight's actions", () => {
    const { unmount } = render(<RightColumn flight={FLIGHT} part="weather" risk={RISK} />);
    expect(present()).toEqual(["refresh-weather"]);
    unmount();
    const risk = render(<RightColumn flight={FLIGHT} part="risk" risk={RISK} />);
    expect(present()).toEqual(["dispatcher-notes", "risk-matrix"]);
    risk.unmount();
    render(<RightColumn flight={FLIGHT} part="release" risk={RISK} />);
    expect(present()).toEqual(["edit", "generate-pdf", "release", "status"]);
  });
});

describe("ReleaseReadinessPanel by step", () => {
  const props = {
    flight: FLIGHT,
    frat: null,
    fratUnavailable: false,
    load: null,
    timeZone: "America/Anchorage",
    canSignForDispatch: true,
  };

  it("shows the FRAT card in the FRAT step and the weight and balance in its own", () => {
    const { unmount } = render(<ReleaseReadinessPanel {...props} part="frat" />);
    expect(screen.getByRole("heading", { name: "FRAT" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Weight and balance" })).not.toBeInTheDocument();
    unmount();
    render(<ReleaseReadinessPanel {...props} part="load" />);
    expect(screen.getByRole("heading", { name: "Weight and balance" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "FRAT" })).not.toBeInTheDocument();
  });
});
