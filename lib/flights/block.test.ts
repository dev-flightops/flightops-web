import { describe, expect, it } from "vitest";

import { blockMs } from "./block";

const H = 3_600_000;
const leg = (seq: number, dep: string, arr: string, marks?: [string, string]) => ({
  sequence: seq,
  origin: "PABE",
  destination: "PADM",
  scheduled_departure_at: dep,
  scheduled_arrival_at: arr,
  actual_departure_at: marks?.[0] ?? null,
  actual_arrival_at: marks?.[1] ?? null,
});

describe("block time by legs (1124-11, 1124-24)", () => {
  const off = "2026-11-19T20:38:00Z";
  const on = "2026-11-20T01:47:00Z"; // 5 h 9 min off to on

  it("counts unmarked legs by their schedule, not first takeoff to last landing", () => {
    const legs = [leg(1, "2026-11-19T20:38:00Z", "2026-11-19T21:18:00Z"), leg(2, "2026-11-20T00:38:00Z", "2026-11-20T01:18:00Z")];
    expect(blockMs({ actual_departure_at: off, actual_arrival_at: on, legs })! / H).toBeCloseTo(80 / 60, 5);
  });

  it("counts a marked leg by its marks", () => {
    const legs = [
      leg(1, "2026-11-19T20:38:00Z", "2026-11-19T21:18:00Z", ["2026-11-19T20:38:00Z", "2026-11-19T21:13:00Z"]),
      leg(2, "2026-11-20T00:38:00Z", "2026-11-20T01:18:00Z"),
    ];
    expect(blockMs({ actual_departure_at: off, actual_arrival_at: on, legs })! / H).toBeCloseTo(75 / 60, 5);
  });

  it("is a single leg's actual times, and nothing until it has landed", () => {
    expect(blockMs({ actual_departure_at: off, actual_arrival_at: "2026-11-19T21:50:00Z" })! / H).toBeCloseTo(1.2, 5);
    expect(blockMs({ actual_departure_at: off, actual_arrival_at: null })).toBeNull();
  });
});
