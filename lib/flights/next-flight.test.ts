import { beforeEach, describe, expect, it, vi } from "vitest";

const { batchWeather } = vi.hoisted(() => ({ batchWeather: vi.fn() }));
vi.mock("@/lib/api/weather", () => ({ batchWeather }));
vi.mock("@/lib/api/ground", () => ({ getFlightAssignment: vi.fn(), listFuelOrders: vi.fn() }));
vi.mock("@/lib/api/manifest", () => ({ getFlightLoad: vi.fn() }));

import type { FlightListItem, WeatherReportResponse } from "@/lib/api/types";

import { observedLabel } from "@/lib/weather-format";

import { stopsWeather } from "./next-flight";

const flight = (stops: string[]) =>
  ({ id: stops.join("-"), origin: stops[0], destination: stops[stops.length - 1], stops }) as unknown as FlightListItem;
const report = (icao: string, raw = `METAR ${icao} 211353Z 27008KT 10SM CLR`) =>
  ({ icao, kind: "metar", raw, parsed_at: "2026-08-21T14:20:00Z" }) as WeatherReportResponse;

beforeEach(() => {
  batchWeather.mockReset();
  batchWeather.mockImplementation(async (requests: { icao: string }[]) => ({
    items: requests.map((r) => report(r.icao)),
    errors: [],
  }));
});

// Codex, web #501: past 20 airports the later ones were dropped unasked.
describe("every stop's weather, in as many batches as it takes", () => {
  const icaos = Array.from({ length: 25 }, (_, i) => `PA${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`);

  it("asks in batches of 20 and keeps every airport", async () => {
    const weather = await stopsWeather([flight(icaos.slice(0, 13)), flight(icaos.slice(12))]);
    expect(batchWeather).toHaveBeenCalledTimes(2);
    expect(batchWeather.mock.calls.map(([r]) => r.length)).toEqual([20, 5]);
    expect(Object.keys(weather).sort()).toEqual([...icaos].sort());
  });

  it("loses only the batch that failed", async () => {
    batchWeather.mockImplementationOnce(async () => {
      throw new Error("down");
    });
    const weather = await stopsWeather([flight(icaos)]);
    expect(Object.keys(weather)).toEqual(icaos.slice(20));
  });

  it("asks once for a stop that comes up twice, and not at all with no flights", async () => {
    await stopsWeather([flight(["PABE", "PAHP", "PABE"])]);
    expect(batchWeather.mock.calls[0][0]).toEqual([
      { icao: "PABE", kind: "metar" },
      { icao: "PAHP", kind: "metar" },
    ]);
    batchWeather.mockClear();
    expect(await stopsWeather([])).toEqual({});
    expect(batchWeather).not.toHaveBeenCalled();
  });
});

describe("when a report was observed", () => {
  it("takes the service's observation time when it gives one", () => {
    expect(observedLabel({ ...report("PABE"), observed_at: "2026-08-21T13:56:00Z" })).toBe("METAR 13:56Z");
  });

  it("reads the report's own time group, never the time it was fetched", () => {
    expect(observedLabel(report("PABE"))).toBe("METAR 13:53Z");
  });

  it("names a special as a SPECI, and says nothing without a time", () => {
    expect(observedLabel(report("PABE", "SPECI PABE 211359Z 18015KT 2SM -SN OVC007"))).toBe("SPECI 13:59Z");
    expect(observedLabel(report("PABE", "PABE NIL"))).toBeNull();
  });
});
