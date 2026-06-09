import { describe, expect, it } from "vitest";

import type { BoardFlightItem, PositionResponse } from "@/lib/api/types";

import { mergeTrackedAircraft } from "./merge-tracked";

function makeFlight(
  overrides: Partial<BoardFlightItem> & { flight_number: string },
): BoardFlightItem {
  const aircraftId = overrides.aircraft?.id ?? "ac-default";
  return {
    id: `flight-${overrides.flight_number}`,
    aircraft: {
      id: aircraftId,
      tail_number: "N207GE",
      model: "Cessna 208",
      seats: 9,
    },
    origin: "PADU",
    destination: "PANC",
    scheduled_departure_at: "2026-06-15T20:00:00Z",
    scheduled_arrival_at: "2026-06-15T22:00:00Z",
    actual_departure_at: null,
    actual_arrival_at: null,
    status: "released",
    pax_count: 4,
    cargo_lbs: 200,
    pic_name: null,
    is_overdue: false,
    last_contact_at: null,
    ...overrides,
  };
}

function makePosition(aircraftId: string): PositionResponse {
  return {
    id: `pos-${aircraftId}`,
    aircraft: { id: aircraftId, tail_number: "N207GE", model: "Cessna 208" },
    flight_id: null,
    latitude: 61.2,
    longitude: -149.9,
    altitude_ft: 8500,
    groundspeed_kt: 175,
    heading_deg: 280,
    source: "simulated",
    reported_at: "2026-06-15T20:30:00Z",
    received_at: "2026-06-15T20:30:30Z",
  };
}

describe("mergeTrackedAircraft", () => {
  it("pairs flights with positions by aircraft.id", () => {
    const flights = [
      makeFlight({ flight_number: "GV1", aircraft: {
        id: "ac-1", tail_number: "N1", model: "C208", seats: 9,
      } }),
      makeFlight({ flight_number: "GV2", aircraft: {
        id: "ac-2", tail_number: "N2", model: "C208", seats: 9,
      } }),
    ];
    const positions = [makePosition("ac-2")];

    const merged = mergeTrackedAircraft(flights, positions);

    expect(merged).toHaveLength(2);
    expect(merged[0].position).toBeNull();
    expect(merged[1].position?.id).toBe("pos-ac-2");
  });

  it("returns null position for flights whose aircraft has no fix yet", () => {
    const flights = [makeFlight({ flight_number: "GV1" })];

    const merged = mergeTrackedAircraft(flights, []);

    expect(merged).toHaveLength(1);
    expect(merged[0].position).toBeNull();
  });

  it("preserves flight order from the board (no re-sorting)", () => {
    // Order matters — the board comes back sorted by
    // scheduled_departure_at, and the side table is expected to mirror it.
    const flights = [
      makeFlight({ flight_number: "Z", aircraft: {
        id: "ac-z", tail_number: "NZ", model: "C208", seats: 9,
      } }),
      makeFlight({ flight_number: "A", aircraft: {
        id: "ac-a", tail_number: "NA", model: "C208", seats: 9,
      } }),
    ];

    const merged = mergeTrackedAircraft(flights, []);

    expect(merged.map((t) => t.flight.flight_number)).toEqual(["Z", "A"]);
  });

  it("shares the same position when two flights use the same aircraft", () => {
    // Back-to-back legs on one tail — both rows point at the same
    // latest fix. Status filtering in the UI decides whether to show
    // altitude/speed (only the currently-airborne leg should).
    const flights = [
      makeFlight({
        flight_number: "LEG1",
        aircraft: { id: "ac-1", tail_number: "N1", model: "C208", seats: 9 },
        status: "completed",
      }),
      makeFlight({
        flight_number: "LEG2",
        aircraft: { id: "ac-1", tail_number: "N1", model: "C208", seats: 9 },
        status: "released",
      }),
    ];
    const positions = [makePosition("ac-1")];

    const merged = mergeTrackedAircraft(flights, positions);

    expect(merged[0].position?.id).toBe("pos-ac-1");
    expect(merged[1].position?.id).toBe("pos-ac-1");
    expect(merged[0].position).toBe(merged[1].position);
  });
});
