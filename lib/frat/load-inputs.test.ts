import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FlightDetail } from "@/lib/api/types";

const calls: string[] = [];
const api = vi.hoisted(() => ({
  batchWeather: vi.fn(),
  weatherCamsFor: vi.fn(),
  getAirports: vi.fn(),
  scoreFlightRisk: vi.fn(),
  getFratPrefill: vi.fn(),
  getFratBlockEligibility: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn(), ApiError: class extends Error {} }));
vi.mock("@/lib/api/weather", () => ({ batchWeather: api.batchWeather }));
vi.mock("@/lib/api/dispatch-risk", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/dispatch-risk")>()),
  weatherCamsFor: api.weatherCamsFor,
  getAirports: api.getAirports,
  scoreFlightRisk: api.scoreFlightRisk,
}));
vi.mock("@/lib/api/ops", () => ({
  getFratPrefill: api.getFratPrefill,
  getFratBlockEligibility: api.getFratBlockEligibility,
}));

import { loadFratInputs } from "./load-inputs";

const flight = {
  id: "f-1",
  origin: "PABE",
  destination: "PABE",
  stops: ["PABE", "PACM", "PABE"],
} as unknown as FlightDetail;

beforeEach(() => {
  calls.length = 0;
  for (const fn of Object.values(api)) fn.mockReset();
  api.batchWeather.mockResolvedValue({
    items: [{ icao: "PABE", kind: "metar", raw: "METAR PABE 171753Z 05006KT 10SM CLR M14/M15 A2969" }],
    errors: [],
  });
  api.weatherCamsFor.mockResolvedValue(null);
  api.getAirports.mockResolvedValue([
    { ident: "PABE", found: true, latitude: 60.78, longitude: -161.84, runways: [] },
  ]);
  api.scoreFlightRisk.mockImplementation(async () => {
    calls.push("score");
    return {};
  });
  api.getFratPrefill.mockImplementation(async () => {
    calls.push("prefill");
    return null;
  });
  api.getFratBlockEligibility.mockResolvedValue(null);
});

/**
 * The client, 17 Nov: "if dispatcher refreshes the data and then it goes back
 * to low, the FRAT should also go back to low." The FRAT page scores the
 * packet again from the weather it gathered, before the prefill reads the
 * packet's level.
 */
describe("the FRAT's inputs, and the packet scored again (17 Nov)", () => {
  it("scores the packet from the same weather, with the airports, before the prefill", async () => {
    await loadFratInputs(flight, { scorePacket: true });
    expect(calls).toEqual(["score", "prefill"]);
    const [flightId, body] = api.scoreFlightRisk.mock.calls[0];
    expect(flightId).toBe("f-1");
    expect(body.stops.map((s: { ident: string }) => s.ident)).toEqual(["PABE", "PACM"]);
    expect(body.stops[0].metar).toMatch(/^METAR PABE/);
    expect(body.stops[0].airport?.found).toBe(true);
    expect(api.batchWeather).toHaveBeenCalledTimes(1);
  });

  it("leaves the packet alone by default, as the preflight does", async () => {
    await loadFratInputs(flight);
    expect(api.scoreFlightRisk).not.toHaveBeenCalled();
    expect(api.getAirports).not.toHaveBeenCalled();
    expect(calls).toEqual(["prefill"]);
  });

  it("still reads the prefill when the packet can't be scored", async () => {
    api.scoreFlightRisk.mockRejectedValue(new Error("ops down"));
    const inputs = await loadFratInputs(flight, { scorePacket: true });
    expect(api.getFratPrefill).toHaveBeenCalled();
    expect(inputs.fratPrefill).toBeNull();
  });
});
