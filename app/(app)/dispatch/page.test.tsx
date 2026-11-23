import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DispatchRisk } from "@/lib/api/dispatch-risk";
import type { FratOverLimits } from "@/lib/api/types";

/**
 * The packet reads the flight's FRAT only once it has scored the packet
 * (17 Nov). ops holds a flight for a HIGH packet by the packet's last
 * score, and the FRAT box, the release blockers and the progress line
 * were read before this load scored it: they showed the previous load's
 * HIGH beside a risk panel scoring the flight LOW, and the client's FRAT
 * filed LOW couldn't be released.
 */

// vi.mock factories run before this file's own lines: what they use is
// made in vi.hoisted.
const { calls, seen, stub } = vi.hoisted(() => ({
  calls: [] as string[],
  seen: {} as { box?: { view: FratOverLimits; risk?: DispatchRisk | null } },
  stub: () => null,
}));

const api = vi.hoisted(() => ({
  auth: vi.fn(),
  listMyTenants: vi.fn(),
  listStaff: vi.fn(),
  loadZoneTable: vi.fn(),
  getCrewClearance: vi.fn(),
  getFlightPlans: vi.fn(),
  getPlansWaiting: vi.fn(),
  listFlightCrew: vi.fn(),
  getComplianceBoard: vi.fn(),
  getCrewOptions: vi.fn(),
  getFlight: vi.fn(),
  getFlightProgress: vi.fn(),
  getFratOverLimits: vi.fn(),
  getLatestFratAssessment: vi.fn(),
  getMorningToday: vi.fn(),
  getPicCompliance: vi.fn(),
  listAircraft: vi.fn(),
  getWeatherMinimums: vi.fn(),
  listFlights: vi.fn(),
  listReleaseAcknowledgments: vi.fn(),
  listWeightReturns: vi.fn(),
  getFlightLoad: vi.fn(),
  listMelItems: vi.fn(),
  listBookingFlights: vi.fn(),
  listBookings: vi.fn(),
  getTypeQualificationGrid: vi.fn(),
  getAreaForecastRegions: vi.fn(),
  loadDispatchRisk: vi.fn(),
  getRouteFreshness: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: api.auth }));
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {} }));
vi.mock("@/lib/api/auth", () => ({
  listMyTenants: api.listMyTenants,
  listStaff: api.listStaff,
  loadZoneTable: api.loadZoneTable,
}));
vi.mock("@/lib/api/drug-alcohol", () => ({ getCrewClearance: api.getCrewClearance }));
vi.mock("@/lib/api/integrations", () => ({
  getFlightPlans: api.getFlightPlans,
  getPlansWaiting: api.getPlansWaiting,
}));
vi.mock("@/lib/api/crew-assignments", () => ({ listFlightCrew: api.listFlightCrew }));
vi.mock("@/lib/api/ops", () => ({
  getComplianceBoard: api.getComplianceBoard,
  getCrewOptions: api.getCrewOptions,
  getFlight: api.getFlight,
  getFlightProgress: api.getFlightProgress,
  getFratOverLimits: api.getFratOverLimits,
  getLatestFratAssessment: api.getLatestFratAssessment,
  getMorningToday: api.getMorningToday,
  getPicCompliance: api.getPicCompliance,
  listAircraft: api.listAircraft,
  getWeatherMinimums: api.getWeatherMinimums,
  listFlights: api.listFlights,
  listReleaseAcknowledgments: api.listReleaseAcknowledgments,
  listWeightReturns: api.listWeightReturns,
}));
vi.mock("@/lib/api/manifest", () => ({ getFlightLoad: api.getFlightLoad }));
vi.mock("@/lib/api/maintenance", () => ({ listMelItems: api.listMelItems }));
vi.mock("@/lib/api/booking-flights", () => ({ listBookingFlights: api.listBookingFlights }));
vi.mock("@/lib/api/reservations", () => ({ listBookings: api.listBookings }));
vi.mock("@/lib/api/type-qualifications", () => ({ getTypeQualificationGrid: api.getTypeQualificationGrid }));
vi.mock("@/lib/api/dispatch-risk", () => ({
  getAreaForecastRegions: api.getAreaForecastRegions,
  loadDispatchRisk: api.loadDispatchRisk,
}));
vi.mock("@/lib/api/weather", () => ({ getRouteFreshness: api.getRouteFreshness }));

// The packet's panels: only the FRAT box matters here.
vi.mock("@/components/dispatch/packet/frat-over-limits-panel", () => ({
  FratOverLimitsPanel: (props: { view: FratOverLimits; risk?: DispatchRisk | null }) => {
    seen.box = props;
    return null;
  },
}));
vi.mock("@/components/dispatch/packet/crew-status-rows", () => ({ CrewLegalityHints: stub }));
vi.mock("@/components/dispatch/packet/dispatch-compliance-gate", () => ({ DispatchComplianceGate: stub }));
vi.mock("@/components/dashboards/aircraft-today-panel", () => ({
  AircraftTodayLine: stub,
  AircraftTodayPanel: stub,
}));
vi.mock("@/components/dispatch/packet/open-mel-panel", () => ({ OpenMelPanel: stub }));
vi.mock("@/components/dispatch/packet/bookings-awaiting-flight-panel", () => ({ BookingsAwaitingFlightPanel: stub }));
vi.mock("@/components/dispatch/packet/foreflight-plan-panel", () => ({ ForeFlightPlanPanel: stub }));
vi.mock("@/components/dispatch/packet/foreflight-plans", () => ({ ForeFlightPlansWaitingBanner: stub }));
vi.mock("@/components/dispatch/packet/weight-returns-panel", () => ({ WeightReturnsPanel: stub }));
vi.mock("@/components/ff/setup-notice", () => ({ LoadFailedNotice: stub }));
vi.mock("@/components/dispatch/packet/flight-details-panel", () => ({ FlightDetailsPanel: stub }));
vi.mock("@/components/dispatch/packet/left-column", () => ({ LeftColumn: stub }));
vi.mock("@/components/dispatch/packet/crew-panel", () => ({ CrewPanel: stub }));
vi.mock("@/components/dispatch/packet/load-from-schedule", () => ({ LoadFromSchedule: stub }));
vi.mock("@/components/dispatch/packet/packet-header", () => ({ PacketHeader: stub }));
vi.mock("@/components/dispatch/packet/right-column", () => ({ RightColumn: stub }));
vi.mock("@/components/dispatch/packet/selected-flight-summary", () => ({ SelectedFlightSummary: stub }));
vi.mock("@/components/dispatch/packet/release-readiness-panel", () => ({ ReleaseReadinessPanel: stub }));
vi.mock("@/components/flights/flight-progress", () => ({ FlightProgress: stub, buildGaps: () => [] }));

import DispatchPage from "./page";

const FLIGHT = "c1841812-4df9-4f6a-bf45-68a8f9b0cdff";

const risk = {
  flight_id: FLIGHT,
  level: "LOW",
  max_score: 4,
  inputs: { area_forecast_product: null },
} as unknown as DispatchRisk;

const box: FratOverLimits = {
  flight_id: FLIGHT,
  flight_number: "TST742",
  scheduled_departure_at: "2026-11-17T20:30:00Z",
  assessment_id: "a-1",
  pilot_name: "Pat Pilot",
  over_limit_factors: [],
  mitigations: null,
  filed_at: "2026-11-17T18:05:15Z",
  accepted: null,
  high_risk: true,
  risk_level: "low",
  packet_level: "high",
  management_required: false,
  high_risk_approved: null,
  waiting: true,
};

/** A read that says when it was asked for. */
function logged<T>(name: string, value: T) {
  return async () => {
    calls.push(name);
    return value;
  };
}

beforeEach(() => {
  calls.length = 0;
  delete seen.box;
  for (const fn of Object.values(api)) fn.mockReset();
  api.auth.mockResolvedValue({ roles: ["dispatcher"] });
  api.loadZoneTable.mockResolvedValue({ byIcao: {}, fallback: "America/Anchorage" });
  api.getFlight.mockResolvedValue({
    id: FLIGHT,
    flight_number: "TST742",
    origin: "PABE",
    destination: "PABE",
    stops: ["PABE", "PACM", "PABE"],
    status: "scheduled",
    scheduled_departure_at: "2026-11-17T20:30:00Z",
    aircraft: { id: "ac-1", tail_number: "N503PA", airframe_type: null },
  });
  api.listFlights.mockResolvedValue({ items: [], total: 0 });
  api.listMyTenants.mockResolvedValue({ tenants: [] });
  api.listStaff.mockResolvedValue({ items: [] });
  api.getPicCompliance.mockResolvedValue(null);
  api.getTypeQualificationGrid.mockResolvedValue(null);
  api.listBookingFlights.mockResolvedValue({ items: [] });
  api.getComplianceBoard.mockResolvedValue({ rows: [] });
  api.listFlightCrew.mockResolvedValue({ items: [], has_pic: false });
  api.listWeightReturns.mockResolvedValue({ items: [] });
  api.listBookings.mockResolvedValue({ items: [], total: 0 });
  api.getPlansWaiting.mockResolvedValue(0);
  api.getCrewOptions.mockResolvedValue({ items: [] });
  api.getMorningToday.mockResolvedValue(null);
  api.listAircraft.mockResolvedValue({ items: [] });
  api.getRouteFreshness.mockResolvedValue(null);
  api.getWeatherMinimums.mockResolvedValue(null);
  api.getAreaForecastRegions.mockResolvedValue([]);
  api.getFlightLoad.mockResolvedValue(null);
  api.listReleaseAcknowledgments.mockResolvedValue({ items: [] });
  api.listMelItems.mockResolvedValue({ items: [] });
  api.getFlightPlans.mockResolvedValue(null);
  api.getCrewClearance.mockResolvedValue(null);
  // Scoring saves the packet's level, which ops then judges the FRAT by.
  api.loadDispatchRisk.mockImplementation(async () => {
    calls.push("score");
    await Promise.resolve();
    calls.push("scored");
    return risk;
  });
  api.getFratOverLimits.mockImplementation(logged("over-limits", box));
  api.getLatestFratAssessment.mockImplementation(logged("frat", { id: "a-1", release_blockers: [] }));
  api.getFlightProgress.mockImplementation(logged("progress", null));
});

async function open() {
  render(await DispatchPage({ searchParams: Promise.resolve({ flight: FLIGHT }) }));
}

describe("the packet reads the FRAT after scoring the packet (17 Nov)", () => {
  it("asks for the FRAT box, the FRAT and the progress line only once the packet is scored", async () => {
    await open();
    // No alternate on a VFR flight (1119-18).
    expect(api.loadDispatchRisk).toHaveBeenCalledWith(FLIGHT, ["PABE", "PACM", "PABE"], null);
    const scored = calls.indexOf("scored");
    expect(scored).toBeGreaterThanOrEqual(0);
    for (const read of ["over-limits", "frat", "progress"]) {
      expect(calls.indexOf(read), read).toBeGreaterThan(scored);
    }
  });

  it("gives the box the score this load made, to name its reasons", async () => {
    await open();
    expect(seen.box?.view).toEqual(box);
    expect(seen.box?.risk).toBe(risk);
  });

  it("still reads the FRAT when the packet can't be scored", async () => {
    api.loadDispatchRisk.mockRejectedValue(new Error("weather service down"));
    await open();
    expect(api.getFratOverLimits).toHaveBeenCalledWith(FLIGHT);
    expect(api.getLatestFratAssessment).toHaveBeenCalledWith(FLIGHT);
    expect(seen.box?.risk).toBeNull();
  });
});
