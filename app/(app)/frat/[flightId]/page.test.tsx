import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A refresh on the FRAT page is the packet's too (17 Nov). The client: "if
 * dispatcher refreshes the data and then it goes back to low, the FRAT should
 * also go back to low." Before release the page scores the packet again from
 * the weather it gathers, and reads the FRAT only then, so its level follows
 * the score just made.
 */

const { calls, stub } = vi.hoisted(() => ({ calls: [] as string[], stub: () => null }));

const api = vi.hoisted(() => ({
  auth: vi.fn(),
  getFlight: vi.fn(),
  getFlightProgress: vi.fn(),
  getFratOverLimits: vi.fn(),
  getLatestFratAssessment: vi.fn(),
  getFratThresholds: vi.fn(),
  loadZoneTable: vi.fn(),
  loadFratInputs: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: api.auth }));
vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {} }));
vi.mock("@/lib/api/ops", () => ({
  getFlight: api.getFlight,
  getFlightProgress: api.getFlightProgress,
  getFratOverLimits: api.getFratOverLimits,
  getLatestFratAssessment: api.getLatestFratAssessment,
}));
vi.mock("@/lib/api/auth", () => ({
  getFratThresholds: api.getFratThresholds,
  loadZoneTable: api.loadZoneTable,
}));
vi.mock("@/lib/frat/load-inputs", () => ({ loadFratInputs: api.loadFratInputs }));
vi.mock("@/app/(app)/flight-crew/preflight/[flightId]/step-1-frat", () => ({ FlightRiskAssessmentStep: stub }));
vi.mock("@/components/dispatch/packet/frat-over-limits-panel", () => ({ FratOverLimitsPanel: stub }));
vi.mock("@/components/ff/page-header", () => ({ PageHeader: stub }));
vi.mock("@/components/frat/frat-signoffs", () => ({ FratSignoffs: stub }));
vi.mock("@/components/flights/flight-progress", () => ({ FlightProgress: stub, buildGaps: () => [] }));

import FratPage from "./page";

const FLIGHT = "c1841812-4df9-4f6a-bf45-68a8f9b0cdff";

function flight(status: string) {
  return {
    id: FLIGHT,
    flight_number: "TST742",
    origin: "PABE",
    destination: "PABE",
    stops: ["PABE", "PACM", "PABE"],
    status,
    scheduled_departure_at: "2026-11-17T20:30:00Z",
    aircraft: { id: "ac-1", tail_number: "N503PA", engine_count: 1, max_demonstrated_crosswind_kt: null },
  };
}

const logged = <T,>(name: string, value: T) => async () => {
  calls.push(name);
  return value;
};

beforeEach(() => {
  calls.length = 0;
  for (const fn of Object.values(api)) fn.mockReset();
  api.auth.mockResolvedValue({ roles: ["dispatcher"], user: { id: "u-disp" } });
  api.getFlight.mockResolvedValue(flight("scheduled"));
  api.getFratThresholds.mockResolvedValue(null);
  api.loadZoneTable.mockResolvedValue({ byIcao: {}, fallback: "America/Anchorage" });
  api.loadFratInputs.mockImplementation(async () => {
    calls.push("inputs");
    await Promise.resolve();
    calls.push("inputs done");
    return { weather: null, fratPrefill: null, fratBlock: null };
  });
  api.getLatestFratAssessment.mockImplementation(logged("frat", null));
  api.getFratOverLimits.mockImplementation(logged("over-limits", null));
  api.getFlightProgress.mockImplementation(logged("progress", null));
});

async function open() {
  render(await FratPage({ params: Promise.resolve({ flightId: FLIGHT }) }));
}

describe("the FRAT page scores the packet before it reads the FRAT (17 Nov)", () => {
  it("scores the packet first, before release", async () => {
    await open();
    expect(api.loadFratInputs).toHaveBeenCalledWith(expect.objectContaining({ id: FLIGHT }), { scorePacket: true });
    const done = calls.indexOf("inputs done");
    for (const read of ["frat", "over-limits", "progress"]) {
      expect(calls.indexOf(read), read).toBeGreaterThan(done);
    }
  });

  it("leaves a released flight's packet as released", async () => {
    api.getFlight.mockResolvedValue(flight("released"));
    await open();
    expect(api.loadFratInputs).toHaveBeenCalledWith(expect.anything(), { scorePacket: false });
  });
});
